// Recall a group's memories from Walrus into memory_snapshots, then verify them the way /demo does.
// Run: pnpm memory:refresh   (4 recalls; defaults to the Flat 3B demo group)
import { readFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
import pg from "pg";
import { buildTimeline, groupNamespace, readSnapshot, reduceLearned, refreshSnapshot, verifyLedger } from "../packages/memory/src/index.ts";

const { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_SERVER_URL, NAMESPACE_SALT, DATABASE_URL_UNPOOLED } = process.env;
for (const [k, v] of Object.entries({ MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, NAMESPACE_SALT, DATABASE_URL_UNPOOLED })) {
  if (!v) throw new Error(`${k} is not set in .env.local`);
}

const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const ledger = { expenses: raw.expenses.map((e) => ({ ...e, amountMinor: BigInt(e.amountMinor) })), settlements: raw.settlements };
const ns = groupNamespace(raw.group.id, NAMESPACE_SALT);
const db = new pg.Pool({ connectionString: DATABASE_URL_UNPOOLED, max: 2 });
const memwal = MemWal.create({ key: MEMWAL_PRIVATE_KEY, accountId: MEMWAL_ACCOUNT_ID, serverUrl: MEMWAL_SERVER_URL, requestTimeoutMs: 45_000 });

try {
  const r = await refreshSnapshot(db, memwal, ns);
  console.log(`refresh ${ns}: ${JSON.stringify(r)}`);
  const snap = await readSnapshot(db, ns);
  if (!snap) throw new Error("no snapshot stored");
  const state = reduceLearned(ns, snap.recalled, snap.degraded);
  const ledgerCheck = verifyLedger(ns, snap.recalled, ledger);
  const days = buildTimeline(state.history);
  console.log(`recalled ${snap.recalled.length} texts in ${snap.recallMs} ms; verified ${state.verified}, rejected ${state.rejected}; relayer count ${snap.relayerCount}`);
  console.log(`ledger: ${JSON.stringify(ledgerCheck)}`);
  console.log(`timeline: ${days.map((d) => `${d.asOf} (${d.entries.length})`).join(", ")}`);
  if (!ledgerCheck.ok || state.rejected > 0) process.exitCode = 1;
} finally {
  memwal.destroy();
  await db.end();
}
