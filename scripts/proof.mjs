// Re-checks the Mainnet evidence in docs/PROOF.md: every settlement confirmed again through Tatum
// (exact USDC in and out), then the memory count per namespace from the Walrus Memory relayer.
// Run: pnpm proof   (loads .env.local; read-only, writes nothing)
import { MemWal } from "@mysten-incubation/memwal";
import { confirmTransfer, createTatum } from "../packages/chain/src/index.ts";

const EMEKA = "0xbc2b335934bb904f0cdce60564844bae509ac81b581fa8330298762d56edaa0a";
const GODSPOWER = "0xac250d52d9dc6456d0c444f1b0a2e20347127f8ad6a18a7a8dbcb8904e4d5bf3";
const TOLU = "0x2f4c5924de9bfd2b0f4a8cf607c7cb3363ade46f5bc2bc50a4965481ede3c94a";
const SETTLEMENTS = [
  { digest: "FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2", from: EMEKA, to: GODSPOWER, amount: 10_000n, how: "pnpm settle:smoke --send" },
  { digest: "Eu7yRGabs6aHsM7pERoULg3HnfM9zZuYRnUNmaNSiXwc", from: GODSPOWER, to: TOLU, amount: 10_000n, how: "app settle API, scripted signer" },
  { digest: "9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV", from: EMEKA, to: GODSPOWER, amount: 50_000n, how: "/app/settle, signed in the browser wallet" },
];
const MIN_MEMORIES = 10;

const env = process.env;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usdc = (micro) => `${(Number(micro) / 1e6).toFixed(2)} USDC`;
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

let failed = 0;
console.log("Tatum (Sui Mainnet GraphQL): each settlement re-read and checked for exact USDC movement");
const tatum = createTatum({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY });
for (const s of SETTLEMENTS) {
  const r = await confirmTransfer(tatum, s.digest, { from: s.from, to: s.to, amount: s.amount, coinType: env.USDC_COIN_TYPE }, { waitMs: 0 });
  if (r.ok) {
    console.log(`  pass  ${s.digest}  ${short(s.from)} → ${short(s.to)}  ${usdc(s.amount)}  checkpoint ${r.value.checkpoint}  ${r.ms} ms`);
    console.log(`        ${s.how}`);
  } else {
    failed++;
    console.log(`  FAIL  ${s.digest}  ${r.error.kind}: ${r.error.message}`);
  }
}

console.log("\nWalrus Memory (Mainnet relayer): memories per namespace");
const memwal = MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz" });
const health = await retry(() => memwal.health());
const pub = (await memwal.getPublicKeyHex()).replace(/^0x/, "").toLowerCase();
const agentOk = pub === env.MEMWAL_AGENT_ID.replace(/^0x/, "").toLowerCase();
const page = await retry(() => memwal.listNamespaces());
const namespaces = page.namespaces ?? [];
const total = namespaces.reduce((sum, ns) => sum + (ns.memory_count ?? 0), 0);
console.log(`  relayer ${health.status ?? "ok"}, version ${health.version ?? "?"}; delegate key = MEMWAL_AGENT_ID: ${agentOk ? "yes" : "NO"}`);
for (const ns of namespaces) console.log(`  ${ns.name.padEnd(24)} ${String(ns.memory_count).padStart(3)}`);
console.log(`  ${"total".padEnd(24)} ${String(total).padStart(3)}  ${total >= MIN_MEMORIES ? "pass" : "FAIL"} (gate: at least ${MIN_MEMORIES} on Mainnet)`);
if (!agentOk || total < MIN_MEMORIES) failed++;
memwal.destroy();

console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
