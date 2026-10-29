// Builds every number and graph in the demo video from Mainnet: Flat 3B's memories recalled from
// Walrus Memory (each envelope hash-checked, each blob fetched from a public Walrus Mainnet
// aggregator) and the three settlements re-read through Tatum's Sui Mainnet GraphQL.
// Run: pnpm video:data   (read-only on Walrus and Sui; refreshes the local memory snapshot)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
import pg from "pg";
import { createTatum, getTransaction } from "../packages/chain/src/index.ts";
import { buildTimeline, groupNamespace, open, readSnapshot, recallNamespace, reduceLearned, refreshSnapshot, verifyLedger } from "../packages/memory/src/index.ts";

const AGGREGATOR = "https://aggregator.walrus-mainnet.walrus.space";
const OUT = new URL("../video/data/mainnet.json", import.meta.url);
const SETTLEMENTS = [
  { digest: "FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2", label: "Emeka → Godspower, first gasless test" },
  { digest: "Eu7yRGabs6aHsM7pERoULg3HnfM9zZuYRnUNmaNSiXwc", label: "Godspower → Tolu, through the app's settle API" },
  { digest: "9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV", label: "Emeka → Godspower, signed in a browser wallet at /app/settle" },
];
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

const env = process.env;
for (const k of ["MEMWAL_PRIVATE_KEY", "MEMWAL_ACCOUNT_ID", "NAMESPACE_SALT", "DATABASE_URL_UNPOOLED", "TATUM_API_KEY", "USDC_COIN_TYPE"]) {
  if (!env[k]) throw new Error(`${k} is not set in .env.local`);
}
const retry = async (fn, tries = 4) => {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2_000 * i));
    }
  }
};

const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const ledger = { expenses: raw.expenses.map((e) => ({ ...e, amountMinor: BigInt(e.amountMinor) })), settlements: raw.settlements };
const ns = groupNamespace(raw.group.id, env.NAMESPACE_SALT);
const db = new pg.Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 2 });
const memwal = MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL, requestTimeoutMs: 45_000 });

try {
  console.log(`Walrus Memory: recalling ${ns} from Mainnet`);
  const refresh = await refreshSnapshot(db, memwal, ns);
  if (!refresh.ok || refresh.error) throw new Error(`recall incomplete: ${refresh.error}`);
  const snap = await readSnapshot(db, ns);
  const state = reduceLearned(ns, snap.recalled);
  const ledgerCheck = verifyLedger(ns, snap.recalled, ledger);
  const days = buildTimeline(state.history);
  console.log(`  recalled ${snap.recalled.length}, verified ${state.verified}, rejected ${state.rejected}, ledger ${ledgerCheck.verifiedEntries}/${ledgerCheck.totalEntries}`);

  const envelopes = [];
  for (const r of snap.recalled) {
    const res = open(r.text, ns);
    if (res.ok) envelopes.push({ env: res.envelope, blobId: r.blob_id });
  }
  const blobOf = (env) => state.sources[env.hash]?.blobId ?? null;
  const ofKind = (kind) => envelopes.filter((e) => e.env.kind === kind);

  // Amounts are shown in USDC at the group's own rate, read from its group_profile memory on Walrus.
  const profiles = await retry(async () => {
    const r = await recallNamespace(memwal, ns, { kinds: ["group_profile"], limit: 5, timeoutMs: 45_000 });
    if (r.errors.length) throw new Error(r.errors[0]);
    return r.recalled;
  });
  const profile = profiles.map((r) => ({ res: open(r.text, ns), blobId: r.blob_id })).find((p) => p.res.ok && p.res.envelope.kind === "group_profile");
  if (!profile) throw new Error("group_profile not recalled from Walrus");
  envelopes.push({ env: profile.res.envelope, blobId: profile.blobId });
  const rate = profile.res.envelope.data.rateNgnPerUsdc;
  const usdcOf = (minor) => Math.round(Number(minor) / rate) / 100;
  console.log(`  group rate ${rate} per USDC, from group_profile blob ${profile.blobId}`);

  // Bills, from the ledger checkpoints stored on Walrus.
  const checkpoints = ofKind("ledger_checkpoint")
    .map(({ env, blobId }) => ({ subject: env.subject, entryCount: env.data.entryCount, ledgerHash: env.data.ledgerHash, blobId, expenses: env.data.expenses }))
    .sort((a, b) => a.entryCount - b.entryCount);
  const bills = [...new Map(checkpoints.flatMap((c) => c.expenses.map((e) => [e.id, { ...e, blobId: c.blobId }]))).values()]
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  let runningMinor = 0n;
  const spend = bills.map((b) => {
    runningMinor += BigInt(b.amountMinor);
    return { date: b.date, description: b.description, category: b.category, payer: b.payerId, usdc: usdcOf(b.amountMinor), cumulativeUsdc: usdcOf(runningMinor), blobId: b.blobId };
  });

  // How it learned: the same timeline /demo shows, with the blob behind each entry.
  let total = 0;
  const learning = days.map((d) => {
    total += d.entries.length;
    const count = (s) => d.entries.filter((e) => e.status === s).length;
    return {
      asOf: d.asOf,
      new: count("new"),
      changed: count("changed"),
      retired: count("retired"),
      cumulative: total,
      entries: d.entries.map((e) => ({ subject: e.env.subject, status: e.status, summary: e.env.data.summary, changes: e.changes, blobId: blobOf(e.env) })),
    };
  });

  const series = (subject, pick) =>
    state.history.filter((e) => e.subject === subject).map((e) => ({ asOf: e.data.asOf, ...pick(e.data.output), summary: e.data.summary, blobId: blobOf(e) }));
  const dieselTurn = series("turn.fuel", (o) => ({ usualPayer: o.usualPayerId, usualCount: o.usualCount, totalCount: o.totalCount, share: o.usualCount / o.totalCount, nextPayer: o.nextPayerId }));
  const groceriesTurn = series("turn.groceries", (o) => ({ usualPayer: o.usualPayerId, usualCount: o.usualCount, totalCount: o.totalCount, nextPayer: o.nextPayerId, retired: o.retired === true }));
  const members = [...new Set(state.history.filter((e) => e.kind === "member_habit").map((e) => e.subject))];
  const settleSpeed = Object.fromEntries(members.map((m) => [m, series(m, (o) => ({ score: o.score, medianDelayDays: o.medianDelay, label: o.label }))]));
  const bills2 = [...new Set(state.history.map((e) => e.subject).filter((s) => s.startsWith("bill.")))];
  const recurringBills = Object.fromEntries(bills2.map((s) => [s, series(s, (o) => ({ description: o.description, cadence: o.cadence, confidence: o.confidence, usdc: usdcOf(o.expectedAmountMinor), next: o.nextExpectedDate }))]));
  const receipts = ofKind("settlement_receipt").map(({ env, blobId }) => ({ digest: env.data.digest, microUsdc: env.data.microUsdc, from: env.data.from, to: env.data.to, blobId }));

  // Every blob this video points at must be readable from Walrus Mainnet itself.
  const blobIds = [...new Set(envelopes.map((e) => e.blobId))];
  const extra = (await db.query("SELECT blob_id FROM memory_outbox WHERE text LIKE $1 AND status = 'stored'", [`%${SETTLEMENTS[2].digest}%`])).rows.map((r) => r.blob_id);
  const toCheck = [...new Set([...blobIds, ...extra])];
  console.log(`Walrus Mainnet aggregator: fetching ${toCheck.length} blobs`);
  const missing = [];
  for (let i = 0; i < toCheck.length; i += 6) {
    await Promise.all(
      toCheck.slice(i, i + 6).map(async (id) => {
        const ok = await retry(async () => {
          const res = await fetch(`${AGGREGATOR}/v1/blobs/${id}`, { headers: { range: "bytes=0-63" }, signal: AbortSignal.timeout(30_000) });
          await res.arrayBuffer();
          if (res.status >= 500) throw new Error(`aggregator ${res.status}`);
          return res.ok;
        });
        if (!ok) missing.push(id);
      }),
    );
  }
  console.log(`  ${toCheck.length - missing.length}/${toCheck.length} available on Walrus Mainnet`);

  console.log("Tatum (Sui Mainnet GraphQL): re-reading the settlements");
  const tatum = createTatum({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY });
  const settlements = [];
  for (const s of SETTLEMENTS) {
    const r = await getTransaction(tatum, s.digest);
    if (!r.ok) throw new Error(`${s.digest}: ${r.error.message}`);
    const tx = r.value;
    const usdc = tx.balanceChanges.filter((c) => c.coinType === env.USDC_COIN_TYPE);
    const payer = usdc.find((c) => c.amount < 0n);
    const payee = usdc.find((c) => c.amount > 0n);
    const gasMist = tx.balanceChanges.filter((c) => c.coinType === SUI && c.owner === payer?.owner).reduce((sum, c) => sum - c.amount, 0n);
    settlements.push({
      ...s,
      status: tx.status,
      checkpoint: tx.checkpoint,
      timestamp: tx.timestamp,
      payer: payer?.owner ?? null,
      payee: payee?.owner ?? null,
      usdc: payee ? Number(payee.amount) / 1e6 : 0,
      payerChange: payer ? Number(payer.amount) / 1e6 : 0,
      payeeChange: payee ? Number(payee.amount) / 1e6 : 0,
      gasSui: Number(gasMist) / 1e9,
      receiptBlobId: receipts.find((x) => x.digest === s.digest)?.blobId ?? extra[0] ?? null,
      suiscan: `https://suiscan.xyz/mainnet/tx/${s.digest}`,
    });
    console.log(`  ${s.digest}  ${tx.status}  ${payee ? Number(payee.amount) / 1e6 : 0} USDC  gas ${Number(gasMist) / 1e9} SUI  checkpoint ${tx.checkpoint}`);
  }

  const page = await retry(() => memwal.listNamespaces());
  const namespaces = (page.namespaces ?? []).map((n) => ({ name: n.name, memories: n.memory_count }));
  const mainnetTotal = namespaces.reduce((sum, n) => sum + (n.memories ?? 0), 0);
  console.log(`Walrus Memory relayer: ${mainnetTotal} memories on Mainnet across ${namespaces.length} namespaces`);

  const out = {
    generatedAt: new Date().toISOString(),
    sources: { walrusMemory: env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz", walrusAggregator: AGGREGATOR, tatum: "Sui Mainnet GraphQL (sui-mainnet.gateway.tatum.io)" },
    namespace: ns,
    currency: { unit: "USDC", groupRate: rate, groupProfileBlobId: profile.blobId },
    recall: { recalled: snap.recalled.length, verified: state.verified, rejected: state.rejected, recallMs: snap.recallMs },
    blobs: { checked: toCheck.length, available: toCheck.length - missing.length, missing },
    ledger: { checkpoints: checkpoints.map(({ expenses, ...c }) => c), verifiedEntries: ledgerCheck.verifiedEntries, totalEntries: ledgerCheck.totalEntries, ok: ledgerCheck.ok },
    spend,
    learning,
    dieselTurn,
    groceriesTurn,
    settleSpeed,
    recurringBills,
    settlements,
    mainnet: { memories: mainnetTotal, namespaces, gate: 10 },
  };
  mkdirSync(new URL(".", OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nwrote video/data/mainnet.json`);
  if (state.rejected || missing.length || !ledgerCheck.ok) process.exitCode = 1;
} finally {
  memwal.destroy();
  await db.end();
}
