// Brick 1 gate: one live Mainnet round trip through the real pipeline.
// seal → Postgres outbox → drain (rememberBulk) → reconcile (Walrus blob ids) → recall → verify.
// Run: pnpm memory:roundtrip   (loads .env.local; spends ≤ 10 relayer points)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
import pg from "pg";
import { buildFlatView } from "../packages/engine/src/index.ts";
import { drain, enqueue, groupNamespace, insightDrafts, loadLearnedState, outboxStats, profileDraft, reconcile } from "../packages/memory/src/index.ts";

const { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_SERVER_URL, NAMESPACE_SALT, DATABASE_URL_UNPOOLED } = process.env;
for (const [k, v] of Object.entries({ MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, NAMESPACE_SALT, DATABASE_URL_UNPOOLED })) {
  if (!v) throw new Error(`${k} is not set in .env.local`);
}

const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const ledger = {
  members: raw.members.map(({ id, displayName }) => ({ id, displayName })),
  expenses: raw.expenses.map((e) => ({ ...e, amountMinor: BigInt(e.amountMinor) })),
  settlements: raw.settlements,
};

const ns = groupNamespace("splitsense-roundtrip", NAMESPACE_SALT);
const db = new pg.Pool({ connectionString: DATABASE_URL_UNPOOLED, max: 2 });
const memwal = MemWal.create({ key: MEMWAL_PRIVATE_KEY, accountId: MEMWAL_ACCOUNT_ID, serverUrl: MEMWAL_SERVER_URL, requestTimeoutMs: 30_000 });
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

try {
  const view = buildFlatView(ledger, raw.now);
  const fuel = insightDrafts(ledger, view).find((d) => d.subject === "turn.fuel");
  const drafts = [profileDraft(ledger, raw.group.rateNgnPerUsdc), fuel];

  const first = await enqueue(db, ns, drafts, new Date().toISOString());
  const again = await enqueue(db, ns, drafts, new Date().toISOString());
  log(`enqueue: queued ${first.queued}, skipped ${first.skipped}; re-run queued ${again.queued}, skipped ${again.skipped}`);
  if (again.queued !== 0) throw new Error("dedupe failed: unchanged drafts were queued twice");

  const sent = await drain(db, memwal);
  log(`drain: ${JSON.stringify(sent)}`);

  let stats = await outboxStats(db, ns);
  for (let i = 0; i < 60 && (stats.sent ?? 0) + (stats.sending ?? 0) + (stats.queued ?? 0) > 0; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    if (stats.queued) log(`drain: ${JSON.stringify(await drain(db, memwal))}`);
    const r = await reconcile(db, memwal);
    stats = await outboxStats(db, ns);
    log(`reconcile: ${JSON.stringify(r)} outbox ${JSON.stringify(stats)}`);
  }

  const { rows } = await db.query(
    "SELECT kind, subject, seq, content_hash, job_id, blob_id, status, sent_at, written_at FROM memory_outbox WHERE namespace = $1 ORDER BY kind, seq",
    [ns],
  );
  const stored = rows.filter((r) => r.status === "stored");
  if (stored.length !== rows.length) throw new Error(`not all memories stored: ${JSON.stringify(stats)}`);

  const learned = await loadLearnedState(memwal, ns, { timeoutMs: 15_000 });
  const recalledFuel = learned.patterns["turn.fuel"];
  const expectedFuel = rows.find((r) => r.subject === "turn.fuel");
  const verified = recalledFuel?.hash === expectedFuel?.content_hash;
  log(`recall: patterns ${Object.keys(learned.patterns).join(",") || "none"}, rejected ${learned.rejected}, degraded ${learned.degraded}, hash verified ${verified}`);
  log(`recalled summary: "${recalledFuel?.data.summary}"`);

  const namespaces = await memwal.listNamespaces();
  const here = namespaces.namespaces.find((n) => n.name === ns);
  log(`relayer namespace ${ns}: ${here?.memory_count ?? 0} memories`);

  mkdirSync(new URL("../docs/evidence/", import.meta.url), { recursive: true });
  const evidence = {
    gate: "brick-1-mainnet-roundtrip",
    ranAt: new Date().toISOString(),
    network: "mainnet",
    relayer: MEMWAL_SERVER_URL,
    namespace: ns,
    memories: rows.map((r) => ({ kind: r.kind, subject: r.subject, seq: r.seq, envelopeHash: r.content_hash, jobId: r.job_id, blobId: r.blob_id, writeSeconds: (r.written_at - r.sent_at) / 1000 })),
    recall: { verified, rejected: learned.rejected, degraded: learned.degraded, learnedHash: learned.hash, summary: recalledFuel?.data.summary ?? null },
    relayerMemoryCount: here?.memory_count ?? null,
  };
  writeFileSync(new URL("../docs/evidence/brick1-roundtrip.json", import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  log("evidence written to docs/evidence/brick1-roundtrip.json");
  if (!verified) process.exitCode = 1;
} finally {
  memwal.destroy();
  await db.end();
}
