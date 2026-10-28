import { hashOf } from "@splitsense/engine";
import type { MemoryClient } from "./client.ts";
import { sealAll, type Draft, type Heads, type MemoryKind } from "./envelope.ts";

/** Structural slice of `pg` so this runs from Next route handlers and plain Node scripts alike. */
export interface Sql {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface Db extends Sql {
  connect(): Promise<Sql & { release(): void }>;
}

/** Relayer limits: 30 pts/min per key, 500/hour per account; a remember costs 5 (ADR-0007). */
export const BUDGET = { batch: 5, perMinute: 5, perHour: 80, maxAttempts: 5, stuckAfterSec: 300 } as const;

/** What would make a memory worth writing again: the learned output, not the date it was computed. */
export function materialHash(d: Draft): string {
  const data = d.data as Record<string, unknown>;
  return hashOf({ kind: d.kind, subject: d.subject, body: "output" in data ? data.output : data });
}

export const asOfOf = (d: Draft): string | null => {
  const asOf = (d.data as { asOf?: unknown }).asOf;
  return typeof asOf === "string" ? asOf : null;
};

/**
 * A draft is worth writing when it differs from the latest memory for its (kind, subject) and,
 * for dated insights, describes a later date. Replaying history therefore writes nothing.
 */
export function isNewKnowledge(d: Draft, latest: { materialHash: string; asOf: string | null } | undefined): boolean {
  if (!latest) return true;
  if (latest.materialHash === materialHash(d)) return false;
  const asOf = asOfOf(d);
  return !(asOf && latest.asOf && asOf <= latest.asOf);
}

/** Seals the drafts that are new knowledge onto each kind's chain and queues them. */
export async function enqueue(db: Db, ns: string, drafts: readonly Draft[], at: string) {
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ns]);
    const heads: Heads = new Map(
      (
        await tx.query("SELECT DISTINCT ON (kind) kind, seq, content_hash FROM memory_outbox WHERE namespace = $1 ORDER BY kind, seq DESC", [ns])
      ).rows.map((r) => [r.kind as MemoryKind, { seq: r.seq as number, hash: r.content_hash as string }]),
    );
    const latest = new Map(
      (
        await tx.query(
          `SELECT DISTINCT ON (kind, subject) kind, subject, material_hash, to_char(as_of, 'YYYY-MM-DD') AS as_of
           FROM memory_outbox WHERE namespace = $1 ORDER BY kind, subject, as_of DESC NULLS LAST, seq DESC`,
          [ns],
        )
      ).rows.map((r) => [`${r.kind}:${r.subject}`, { materialHash: r.material_hash as string, asOf: r.as_of as string | null }]),
    );
    const fresh = drafts.filter((d) => isNewKnowledge(d, latest.get(`${d.kind}:${d.subject}`)));
    const { sealed } = sealAll(fresh, ns, heads, at);
    for (const [i, s] of sealed.entries()) {
      await tx.query(
        `INSERT INTO memory_outbox (namespace, kind, subject, seq, content_hash, material_hash, as_of, text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (content_hash) DO NOTHING`,
        [ns, s.envelope.kind, s.envelope.subject, s.envelope.seq, s.envelope.hash, materialHash(fresh[i]!), asOfOf(fresh[i]!), s.text],
      );
    }
    await tx.query("COMMIT");
    return { queued: sealed.length, skipped: drafts.length - fresh.length };
  } catch (e) {
    await tx.query("ROLLBACK");
    throw e;
  } finally {
    tx.release();
  }
}

export interface DrainResult {
  sent: number;
  budgetLeft: number;
  throttled: boolean;
  error?: string;
}

/** Sends at most one batch of queued memories within the rate budget. Safe to call concurrently. */
export async function drain(db: Sql, client: Pick<MemoryClient, "rememberBulk">): Promise<DrainResult> {
  await db.query(
    `UPDATE memory_outbox SET status = 'queued', last_error = 'requeued: stuck while sending'
     WHERE status = 'sending' AND sent_at < now() - make_interval(secs => $1)`,
    [BUDGET.stuckAfterSec],
  );
  const { rows: [use] } = await db.query(
    `SELECT count(*) FILTER (WHERE sent_at > now() - interval '1 minute')::int AS m,
            count(*) FILTER (WHERE sent_at > now() - interval '1 hour')::int AS h
     FROM memory_outbox WHERE sent_at > now() - interval '1 hour'`,
  );
  const n = Math.min(BUDGET.batch, BUDGET.perMinute - use.m, BUDGET.perHour - use.h);
  if (n <= 0) return { sent: 0, budgetLeft: 0, throttled: true };

  const { rows } = await db.query(
    `UPDATE memory_outbox SET status = 'sending', attempts = attempts + 1, sent_at = now()
     WHERE id IN (SELECT id FROM memory_outbox WHERE status = 'queued' ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING id, namespace, text, attempts`,
    [n],
  );
  if (rows.length === 0) return { sent: 0, budgetLeft: n, throttled: false };
  rows.sort((a, b) => Number(a.id) - Number(b.id));

  try {
    const accepted = await client.rememberBulk(rows.map((r) => ({ text: r.text, namespace: r.namespace })));
    for (const [i, r] of rows.entries()) {
      await db.query("UPDATE memory_outbox SET status = 'sent', job_id = $2, last_error = NULL WHERE id = $1", [r.id, accepted.job_ids[i] ?? null]);
    }
    return { sent: rows.length, budgetLeft: n - rows.length, throttled: false };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const throttled = err.status === 429;
    const message = `${err.status ?? "error"}: ${(err.message ?? String(e)).slice(0, 300)}`;
    await db.query(
      `UPDATE memory_outbox SET status = CASE WHEN NOT $3 AND attempts >= $4 THEN 'failed' ELSE 'queued' END, last_error = $2
       WHERE id = ANY($1::bigint[])`,
      [rows.map((r) => r.id), message, throttled, BUDGET.maxAttempts],
    );
    return { sent: 0, budgetLeft: 0, throttled, error: message };
  }
}

/** Moves sent jobs to `stored` with their Walrus blob id, or back to the queue if the relayer failed them. */
export async function reconcile(db: Sql, client: Pick<MemoryClient, "getRememberBulkStatus">, limit = 50) {
  const { rows } = await db.query("SELECT id, job_id FROM memory_outbox WHERE status = 'sent' AND job_id IS NOT NULL ORDER BY id LIMIT $1", [limit]);
  if (rows.length === 0) return { stored: 0, failed: 0, pending: 0 };
  const byJob = new Map(rows.map((r) => [r.job_id as string, r.id]));
  const { results } = await client.getRememberBulkStatus([...byJob.keys()]);
  let stored = 0;
  let failed = 0;
  for (const s of results) {
    const id = byJob.get(s.job_id);
    if (id === undefined) continue;
    if (s.status === "done" && s.blob_id) {
      await db.query("UPDATE memory_outbox SET status = 'stored', blob_id = $2, written_at = now() WHERE id = $1", [id, s.blob_id]);
      stored++;
    } else if (s.status === "failed" || s.status === "not_found") {
      await db.query(
        `UPDATE memory_outbox SET status = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'queued' END, last_error = $2 WHERE id = $1`,
        [id, `relayer ${s.status}: ${(s.error ?? "").slice(0, 300)}`, BUDGET.maxAttempts],
      );
      failed++;
    }
  }
  return { stored, failed, pending: rows.length - stored - failed };
}

export async function outboxStats(db: Sql, ns?: string) {
  const { rows } = await db.query(
    `SELECT status, count(*)::int AS n FROM memory_outbox WHERE ($1::text IS NULL OR namespace = $1) GROUP BY status`,
    [ns ?? null],
  );
  return Object.fromEntries(rows.map((r) => [r.status as string, r.n as number])) as Record<string, number>;
}
