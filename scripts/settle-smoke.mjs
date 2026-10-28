// Settlement smoke test (ADR-0008): payer → payee USDC, built, simulated and executed through
// Tatum's Sui GraphQL, then confirmed with confirmTransfer. Dry run unless --send.
// usage: node --env-file=.env.local scripts/settle-smoke.mjs [amountMicro=10000] [--send]
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { confirmTransfer, createTatum, formatCoin, getBalance, SUI_COIN_TYPE, tatumSuiClient, transferTx } from "../packages/chain/src/index.ts";

const send = process.argv.includes("--send");
const amount = BigInt(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? "10000");
const USDC = process.env.USDC_COIN_TYPE;
const keypair = (name) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(process.env[name]).secretKey);
const payer = keypair("SUI_PAYER_PRIVATE_KEY");
const payee = keypair("SUI_PAYEE_PRIVATE_KEY").toSuiAddress();
const from = payer.toSuiAddress();

const tatum = createTatum({ url: process.env.TATUM_SUI_GRAPHQL_URL, apiKey: process.env.TATUM_API_KEY });
const sui = tatumSuiClient({ url: process.env.TATUM_SUI_GRAPHQL_URL, apiKey: process.env.TATUM_API_KEY, fetch: tatum.fetch });
const balances = async (label) => {
  const [pu, ps, eu] = [await getBalance(tatum, from, USDC), await getBalance(tatum, from, SUI_COIN_TYPE), await getBalance(tatum, payee, USDC)];
  console.log(`${label}: payer ${formatCoin(pu.value, USDC)} + ${formatCoin(ps.value, SUI_COIN_TYPE)} · payee ${formatCoin(eu.value, USDC)}`);
};

await balances("before");
const expected = { from, to: payee, amount, coinType: USDC };
const bytes = await transferTx(expected).build({ client: sui });
const { gasData } = Transaction.from(bytes).getData();
console.log("built", bytes.length, "bytes · gas price", gasData.price, "· budget", gasData.budget, "· gas payment", gasData.payment?.length ?? 0, "objects");

const sim = await sui.simulateTransaction({ transaction: bytes, include: { balanceChanges: true, effects: true } });
const simTx = sim.Transaction ?? sim.FailedTransaction;
console.log("simulated:", sim.$kind, JSON.stringify(simTx.effects?.status ?? null), simTx.balanceChanges?.map((b) => `${b.address.slice(0, 8)} ${formatCoin(BigInt(b.amount), b.coinType)}`).join(", "));
if (sim.$kind !== "Transaction") process.exit(1);
if (!send) {
  console.log("dry run only: nothing signed. Re-run with --send.");
  process.exit(0);
}

const started = Date.now();
const result = await sui.signAndExecuteTransaction({ transaction: bytes, signer: payer, include: { effects: true } });
const tx = result.Transaction ?? result.FailedTransaction;
console.log("executed:", result.$kind, tx.digest, `https://suiscan.xyz/mainnet/tx/${tx.digest}`, `${Date.now() - started} ms`);
const confirmed = await confirmTransfer(tatum, tx.digest, expected);
console.log("confirmed through Tatum:", confirmed.ok ? JSON.stringify(confirmed.value, (_, v) => (typeof v === "bigint" ? v.toString() : v)) : confirmed.error, `${confirmed.ms} ms`);
await balances("after");
