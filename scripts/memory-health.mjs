// Read-only Walrus Memory check: relayer health, delegate key ↔ MEMWAL_AGENT_ID, namespaces.
// Run: pnpm memory:health   (loads .env.local)
import { MemWal } from "@mysten-incubation/memwal";

const { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_AGENT_ID, MEMWAL_SERVER_URL } = process.env;
for (const [k, v] of Object.entries({ MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_AGENT_ID })) {
  if (!v) throw new Error(`${k} is not set in .env.local`);
}

const memwal = MemWal.create({
  key: MEMWAL_PRIVATE_KEY,
  accountId: MEMWAL_ACCOUNT_ID,
  serverUrl: MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
});

const health = await memwal.health();
console.log("relayer health:", JSON.stringify(health));

const pub = (await memwal.getPublicKeyHex()).replace(/^0x/, "").toLowerCase();
const agent = MEMWAL_AGENT_ID.replace(/^0x/, "").toLowerCase();
console.log(`delegate public key matches MEMWAL_AGENT_ID: ${pub === agent ? "yes" : "NO"}`);

const page = await memwal.listNamespaces();
const namespaces = page.namespaces ?? [];
const total = namespaces.reduce((sum, ns) => sum + (ns.memory_count ?? 0), 0);
console.log(`namespaces: ${namespaces.length}, memories: ${total}${page.has_more ? " (more pages)" : ""}`);
for (const ns of namespaces) console.log(`  ${ns.name}: ${ns.memory_count}`);

memwal.destroy();
process.exit(pub === agent ? 0 : 1);
