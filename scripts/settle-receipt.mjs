// Writes the settlement_receipt memory for a demo-flat payment, only after Tatum confirms it.
// usage: node --env-file=.env.local scripts/settle-receipt.mjs <digest> [microUsdc=10000] [from=emeka] [to=godspower]
import { readFileSync } from "node:fs";
import { MemWal } from "@mysten-incubation/memwal";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import pg from "pg";
import { confirmTransfer, createTatum } from "../packages/chain/src/index.ts";
import { drain, enqueue, groupNamespace, outboxStats, receiptDraft, reconcile } from "../packages/memory/src/index.ts";

const [digest, micro = "10000", from = "emeka", to = "godspower"] = process.argv.slice(2);
if (!digest) throw new Error("usage: settle-receipt.mjs <digest> [microUsdc] [from] [to]");
const env = process.env;
const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const address = (name) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(env[name]).secretKey).toSuiAddress();
const expected = { from: address("SUI_PAYER_PRIVATE_KEY"), to: address("SUI_PAYEE_PRIVATE_KEY"), amount: BigInt(micro), coinType: env.USDC_COIN_TYPE };

const tatum = createTatum({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY });
const confirmed = await confirmTransfer(tatum, digest, expected);
if (!confirmed.ok) throw new Error(`not confirmed by Tatum: ${confirmed.error.kind}: ${confirmed.error.message}`);
const c = confirmed.value;
console.log(`confirmed through Tatum in ${confirmed.ms} ms: checkpoint ${c.checkpoint}, ${c.timestamp}`);

const ns = groupNamespace(raw.group.id, env.NAMESPACE_SALT);
const draft = receiptDraft({
  from,
  to,
  fromAddress: c.from,
  toAddress: c.to,
  microUsdc: c.amount,
  rateNgnPerUsdc: raw.group.rateNgnPerUsdc,
  coinType: c.coinType,
  digest: c.digest,
  checkpoint: c.checkpoint === null ? undefined : String(c.checkpoint),
  settledAt: c.timestamp ?? new Date().toISOString(),
  expenseIds: [],
});

const db = new pg.Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 2 });
const memwal = MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL, requestTimeoutMs: 30_000 });
try {
  const q = await enqueue(db, ns, [draft], new Date().toISOString());
  console.log(`namespace ${ns}: queued ${q.queued}, skipped ${q.skipped}`);
  let stats = await outboxStats(db, ns);
  for (let i = 0; i < 60 && (stats.queued ?? 0) + (stats.sending ?? 0) + (stats.sent ?? 0) > 0; i++) {
    if (stats.queued) console.log("drain", JSON.stringify(await drain(db, memwal)));
    await new Promise((r) => setTimeout(r, 3000));
    await reconcile(db, memwal);
    stats = await outboxStats(db, ns);
  }
  const { rows } = await db.query(`SELECT seq, status, blob_id, content_hash FROM memory_outbox WHERE namespace = $1 AND kind = 'settlement_receipt' AND subject = $2`, [ns, digest]);
  console.log("receipt:", JSON.stringify(rows[0] ?? null), "outbox", JSON.stringify(stats));
} finally {
  await db.end();
  memwal.destroy();
}
