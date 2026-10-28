// Drives the app's settle API the way a browser wallet does: prepare → sign → execute.
// Without --send it only checks the rejections (nothing reaches the chain).
// usage: node --env-file=.env.local scripts/settle-api.mjs [base=http://localhost:3100] [--send <payerKeyVar> <to> <microUsdc>]
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const keypair = (name) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(process.env[name]).secretKey);
const post = async (path, body, headers = {}) => {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const check = (label, got, status) => {
  const ok = [status].flat().includes(got.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${got.status} ${JSON.stringify(got.body).slice(0, 140)}`);
  if (!ok) process.exitCode = 1;
};

const emeka = keypair("SUI_PAYER_PRIVATE_KEY");
const gp = keypair("SUI_PAYEE_PRIVATE_KEY");
const intent = { address: emeka.toSuiAddress(), to: "ada", microUsdc: "10000" };

const prepared = await post("/api/settle/prepare", intent);
check("prepare builds a transaction", prepared, 200);
const bytes = fromBase64(prepared.body.bytes);
const { signature } = await emeka.signTransaction(bytes);

check("over the debt is refused", await post("/api/settle/prepare", { ...intent, microUsdc: "999000000" }), 400);
check("below 0.01 USDC is refused", await post("/api/settle/prepare", { ...intent, microUsdc: "9999" }), 400);
check("someone you don't owe is refused", await post("/api/settle/prepare", { ...intent, to: "emeka" }), 409);
check("wallet outside the flat is refused", await post("/api/settle/prepare", { ...intent, address: `0x${"ab".repeat(32)}` }), 404);
check("cross-site is refused", await post("/api/settle/prepare", intent, { "sec-fetch-site": "cross-site" }), 403);
check("someone else's signature is refused", await post("/api/settle/execute", { ...intent, bytes: prepared.body.bytes, signature: (await gp.signTransaction(bytes)).signature }), 403);
check("claimed amount ≠ signed amount is refused", await post("/api/settle/execute", { ...intent, microUsdc: "20000", bytes: prepared.body.bytes, signature }), 422);
check("signed by Emeka, claimed as Godspower is refused", await post("/api/settle/execute", { ...intent, address: gp.toSuiAddress(), to: "tolu", bytes: prepared.body.bytes, signature }), [403, 409]);

const send = args.indexOf("--send");
if (send >= 0) {
  const [keyVar, to, micro] = args.slice(send + 1);
  const payer = keypair(keyVar);
  const body = { address: payer.toSuiAddress(), to, microUsdc: micro };
  const p = await post("/api/settle/prepare", body);
  check(`prepare ${keyVar} → ${to}`, p, 200);
  const signed = await payer.signTransaction(fromBase64(p.body.bytes));
  const started = Date.now();
  const r = await post("/api/settle/execute", { ...body, bytes: p.body.bytes, signature: signed.signature });
  check("execute", r, 200);
  console.log(`settled in ${Date.now() - started} ms: https://suiscan.xyz/mainnet/tx/${r.body?.digest}`);
}
