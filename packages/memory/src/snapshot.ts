import type { MemoryClient } from "./client.ts";
import { recallNamespace, type Recalled } from "./learned.ts";
import type { Sql } from "./outbox.ts";

export interface MemorySnapshot {
  namespace: string;
  recalled: Recalled[];
  recalledAt: string;
  recallMs: number;
  relayerCount: number | null;
  degraded: boolean;
  error: string | null;
  /** When the last refresh attempt ran, successful or not. */
  attemptedAt: string;
}

/**
 * Recalls everything the page needs (patterns, habits, ledger checkpoints, settlement receipts: 4 recalls) and stores the
 * raw texts. The page re-verifies them on every render, so the cache can't be trusted blindly.
 * A failed refresh keeps the previous texts and records the error. A partial one (some recalls failed) adds what it got to
 * the previous texts instead of replacing them: memories are append-only, so nothing in the old snapshot can be stale.
 */
export async function refreshSnapshot(db: Sql, client: Pick<MemoryClient, "recall" | "listNamespaces">, ns: string, timeoutMs = 20_000) {
  const r = await recallNamespace(client, ns, {
    kinds: ["pattern_snapshot", "member_habit", "ledger_checkpoint", "settlement_receipt"],
    limit: { pattern_snapshot: 45, member_habit: 50, ledger_checkpoint: 10, settlement_receipt: 10 },
    timeoutMs,
    sequential: true,
  });
  let relayerCount: number | null = null;
  try {
    const page = await client.listNamespaces({ limit: 100 });
    relayerCount = page.namespaces.find((n) => n.name === ns)?.memory_count ?? null;
  } catch {}
  const error = r.errors.length ? r.errors.join("; ").slice(0, 500) : null;
  if (r.recalled.length === 0 && error) {
    await db.query(`UPDATE memory_snapshots SET error = $2, attempted_at = now() WHERE namespace = $1`, [ns, error]);
    return { ok: false, recalled: 0, ms: r.ms, error };
  }
  let recalled = r.recalled;
  if (error) {
    const previous = (await readSnapshot(db, ns))?.recalled ?? [];
    const seen = new Set(recalled.map((m) => m.text));
    recalled = [...recalled, ...previous.filter((m) => !seen.has(m.text))];
  }
  await db.query(
    `INSERT INTO memory_snapshots (namespace, recalled, recalled_at, recall_ms, relayer_count, degraded, error, attempted_at)
     VALUES ($1, $2::jsonb, now(), $3, $4, $5, $6, now())
     ON CONFLICT (namespace) DO UPDATE SET recalled = EXCLUDED.recalled, recalled_at = EXCLUDED.recalled_at, recall_ms = EXCLUDED.recall_ms,
       relayer_count = EXCLUDED.relayer_count, degraded = EXCLUDED.degraded, error = EXCLUDED.error, attempted_at = EXCLUDED.attempted_at`,
    [ns, JSON.stringify(recalled), r.ms, relayerCount, r.degraded, error],
  );
  return { ok: true, recalled: recalled.length, ms: r.ms, error };
}

export async function readSnapshot(db: Sql, ns: string): Promise<MemorySnapshot | null> {
  const { rows } = await db.query(
    `SELECT namespace, recalled, recalled_at, recall_ms, relayer_count, degraded, error, attempted_at FROM memory_snapshots WHERE namespace = $1`,
    [ns],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    namespace: r.namespace,
    recalled: r.recalled,
    recalledAt: new Date(r.recalled_at).toISOString(),
    recallMs: r.recall_ms,
    relayerCount: r.relayer_count,
    degraded: r.degraded,
    error: r.error,
    attemptedAt: new Date(r.attempted_at).toISOString(),
  };
}
