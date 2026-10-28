// Brick 2: write the Flat 3B history to Walrus Memory on Mainnet, paced by the outbox budget.
// Idempotent and resumable: unchanged memories are skipped, so re-running only finishes what is left.
// Run: pnpm seed:mainnet [--dry-run]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
import pg from "pg";
import { drain, enqueue, groupNamespace, materialHash, outboxStats, recallNamespace, reconcile, reduceLearned, seedPhases } from "../packages/memory/src/index.ts";

const DRY = process.argv.includes("--dry-run");
const PHASES = ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15", "2026-11-01"];
const TICK_MS = 12_000;
const DEADLINE_MS = 25 * 60_000;

const { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_SERVER_URL, NAMESPACE_SALT, DATABASE_URL_UNPOOLED } = process.env;
for (const [k, v] of Object.entries({ NAMESPACE_SALT, ...(DRY ? {} : { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, DATABASE_URL_UNPOOLED }) })) {
  if (!v) throw new Error(`${k} is not set in .env.local`);
}

const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const ledger = {
  members: raw.members.map(({ id, displayName }) => ({ id, displayName })),
  expenses: raw.expenses.map((e) => ({ ...e, amountMinor: BigInt(e.amountMinor) })),
  settlements: raw.settlements,
};
const ns = groupNamespace(raw.group.id, NAMESPACE_SALT);
const phases = seedPhases(ledger, raw.group.rateNgnPerUsdc, PHASES);
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`);

if (DRY) {
  const seen = new Set();
  let total = 0;
  for (const p of phases) {
    const fresh = p.drafts.filter((d) => !seen.has(materialHash(d)));
    fresh.forEach((d) => seen.add(materialHash(d)));
    total += fresh.length;
    log(`${p.asOf}: ${fresh.length} new — ${fresh.map((d) => `${d.kind}:${d.subject}`).join(", ")}`);
  }
  log(`${ns}: ${total} memories would be written`);
  process.exit(0);
}

const db = new pg.Pool({ connectionString: DATABASE_URL_UNPOOLED, max: 2 });
const memwal = MemWal.create({ key: MEMWAL_PRIVATE_KEY, accountId: MEMWAL_ACCOUNT_ID, serverUrl: MEMWAL_SERVER_URL, requestTimeoutMs: 30_000 });

try {
  for (const p of phases) {
    const r = await enqueue(db, ns, p.drafts, new Date().toISOString());
    log(`phase ${p.asOf}: queued ${r.queued}, already written ${r.skipped}`);
  }

  const open = (s) => (s.queued ?? 0) + (s.sending ?? 0) + (s.sent ?? 0);
  let stats = await outboxStats(db, ns);
  while (open(stats) > 0) {
    if (Date.now() - t0 > DEADLINE_MS) throw new Error(`deadline reached with ${open(stats)} memories still open; re-run to resume`);
    try {
      const d = await drain(db, memwal);
      const r = await reconcile(db, memwal);
      stats = await outboxStats(db, ns);
      log(`sent ${d.sent}${d.throttled ? " (budget wait)" : ""}${d.error ? ` error ${d.error}` : ""} · stored +${r.stored}${r.failed ? ` failed ${r.failed}` : ""} · ${JSON.stringify(stats)}`);
    } catch (e) {
      log(`transient error, retrying next tick: ${e.cause?.code ?? e.message}`);
    }
    if (open(stats) > 0) await new Promise((res) => setTimeout(res, TICK_MS));
  }

  const { rows } = await db.query(
    `SELECT kind, subject, seq, content_hash, blob_id, status, text, written_at FROM memory_outbox WHERE namespace = $1 ORDER BY id`,
    [ns],
  );
  const page = await memwal.listNamespaces({ limit: 100 });
  const relayerCount = page.namespaces.find((n) => n.name === ns)?.memory_count ?? null;
  log(`done: ${rows.filter((r) => r.status === "stored").length} stored, ${rows.filter((r) => r.status === "failed").length} failed; relayer memory_count ${relayerCount}`);

  const recall = await recallNamespace(memwal, ns, {
    kinds: ["pattern_snapshot", "member_habit"],
    limit: { pattern_snapshot: 45, member_habit: 50 },
    timeoutMs: 20_000,
    sequential: true,
  });
  const learned = reduceLearned(ns, recall.recalled, recall.degraded);
  const recallMs = recall.ms;
  const latest = Object.fromEntries([...Object.entries(learned.patterns), ...Object.entries(learned.habits)].map(([k, v]) => [k, v.data.asOf]));
  log(`recall: ${Object.keys(learned.patterns).length} patterns, ${Object.keys(learned.habits).length} habits, timeline ${learned.history.length}, rejected ${learned.rejected}, degraded ${learned.degraded}, ${recallMs} ms`);
  log(`latest asOf per subject: ${JSON.stringify(latest)}`);

  mkdirSync(new URL("../docs/evidence/", import.meta.url), { recursive: true });
  const evidence = {
    gate: "brick-2-mainnet-seed",
    ranAt: new Date().toISOString(),
    network: "mainnet",
    group: raw.group.name,
    synthetic: raw.synthetic,
    namespace: ns,
    relayerMemoryCount: relayerCount,
    phases: PHASES,
    recall: { ms: recallMs, patterns: Object.keys(learned.patterns).length, habits: Object.keys(learned.habits).length, timeline: learned.history.length, rejected: learned.rejected, degraded: learned.degraded, latestAsOf: latest, learnedHash: learned.hash },
    memories: rows.map((r, i) => {
      const asOf = JSON.parse(r.text.slice(r.text.indexOf("\n") + 1)).data.asOf ?? null;
      const original = asOf && rows.slice(0, i).find((o) => o.kind === r.kind && o.subject === r.subject && o.text.includes(`"asOf":"${asOf}"`));
      return { kind: r.kind, subject: r.subject, seq: r.seq, asOf, status: r.status, envelopeHash: r.content_hash, blobId: r.blob_id, writtenAt: r.written_at, ...(original ? { replayOfSeq: original.seq } : {}) };
    }),
  };
  writeFileSync(new URL("../docs/evidence/brick2-seed.json", import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  log("evidence written to docs/evidence/brick2-seed.json");
  if (rows.some((r) => r.status !== "stored")) process.exitCode = 1;
} finally {
  memwal.destroy();
  await db.end();
}
