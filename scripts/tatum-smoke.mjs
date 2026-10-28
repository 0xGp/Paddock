// Tatum Sui GraphQL smoke test (ADR-0004). Run: pnpm tatum:smoke
const URL = process.env.TATUM_SUI_GRAPHQL_URL ?? "https://sui-mainnet.gateway.tatum.io/graphql";
const KEY = process.env.TATUM_API_KEY;
const USDC = process.env.USDC_COIN_TYPE;
if (!KEY) throw new Error("TATUM_API_KEY is not set in .env.local");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(label, query, variables = {}) {
  const started = performance.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ query, variables }),
  });
  const ms = Math.round(performance.now() - started);
  const body = await res.json();
  const ok = res.ok && !body.errors;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} (${ms} ms, plan ${res.headers.get("x-ttm-plan")})`);
  if (!ok) console.log(JSON.stringify(body.errors ?? body).slice(0, 400));
  await sleep(400); // free plan: 3 req/s
  return body.data;
}

const head = await gql("chain + checkpoint", "{ chainIdentifier checkpoint { sequenceNumber } }");
console.log(`     chain ${head?.chainIdentifier}, checkpoint ${head?.checkpoint?.sequenceNumber}`);

const recent = await gql("recent tx", "{ checkpoint { transactions(first: 1) { nodes { digest } } } }");
const digest = recent?.checkpoint?.transactions?.nodes?.[0]?.digest;
if (digest) {
  const tx = await gql(
    "tx effects by digest",
    `query ($d: String!) { transaction(digest: $d) { effects { status checkpoint { sequenceNumber } balanceChanges(first: 5) { nodes { amount coinType { repr } } } } } }`,
    { d: digest },
  );
  console.log(`     ${digest} → ${tx?.transaction?.effects?.status}`);
}

if (USDC) {
  const bal = await gql(
    "USDC balance",
    `query ($a: SuiAddress!, $t: String!) { address(address: $a) { balance(coinType: $t) { totalBalance } } }`,
    { a: "0x0000000000000000000000000000000000000000000000000000000000000005", t: USDC },
  );
  console.log(`     0x5 USDC (micro) = ${bal?.address?.balance?.totalBalance}`);
}
