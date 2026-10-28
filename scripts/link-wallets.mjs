// Links the demo flat's wallets to its members and records payments already confirmed on chain.
// Idempotent. usage: node --env-file=.env.local scripts/link-wallets.mjs [digest...]
import { readFileSync } from "node:fs";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import pg from "pg";
import { confirmTransfer, createTatum, getTransaction } from "../packages/chain/src/index.ts";

const env = process.env;
const raw = JSON.parse(readFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), "utf8"));
const KEYS = { emeka: "SUI_PAYER_PRIVATE_KEY", godspower: "SUI_PAYEE_PRIVATE_KEY", ada: "SUI_ADA_PRIVATE_KEY", tolu: "SUI_TOLU_PRIVATE_KEY" };
const address = (name) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(env[name]).secretKey).toSuiAddress();

const links = Object.entries(KEYS).filter(([, key]) => env[key]).map(([member, key]) => ({ member, address: address(key) }));
const memberOf = new Map(links.map((l) => [l.address, l.member]));
const tatum = createTatum({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY });
const db = new pg.Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 2 });

try {
  for (const l of links) {
    await db.query(
      `INSERT INTO wallet_links (address, group_key, member_key) VALUES ($1, $2, $3)
       ON CONFLICT (group_key, member_key) DO UPDATE SET address = EXCLUDED.address`,
      [l.address, raw.group.id, l.member],
    );
    console.log(`linked ${l.member.padEnd(10)} ${l.address}`);
  }

  for (const digest of process.argv.slice(2)) {
    const tx = await getTransaction(tatum, digest);
    if (!tx.ok) throw new Error(`${digest}: ${tx.error.kind}: ${tx.error.message}`);
    const coinType = env.USDC_COIN_TYPE;
    const changes = tx.value.balanceChanges.filter((c) => c.coinType === coinType);
    const out = changes.find((c) => c.amount < 0n);
    const into = changes.find((c) => c.amount > 0n);
    if (!out || !into) throw new Error(`${digest}: not a USDC transfer`);
    const expected = { from: out.owner, to: into.owner, amount: into.amount, coinType };
    const c = await confirmTransfer(tatum, digest, expected);
    if (!c.ok) throw new Error(`${digest}: ${c.error.kind}: ${c.error.message}`);
    const from = memberOf.get(c.value.from), to = memberOf.get(c.value.to);
    if (!from || !to) throw new Error(`${digest}: sender or recipient is not a linked wallet`);
    const amountMinor = (c.value.amount * BigInt(raw.group.rateNgnPerUsdc) * 100n) / 1_000_000n;
    await db.query(
      `INSERT INTO payments (digest, group_key, from_member, to_member, from_address, to_address, micro_usdc, amount_minor, coin_type, checkpoint, settled_at, confirm_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (digest) DO NOTHING`,
      [digest, raw.group.id, from, to, c.value.from, c.value.to, c.value.amount, amountMinor, coinType, c.value.checkpoint, c.value.timestamp, c.ms],
    );
    console.log(`payment ${digest}: ${from} → ${to}, ${c.value.amount} micro USDC, checkpoint ${c.value.checkpoint}`);
  }
} finally {
  await db.end();
}
