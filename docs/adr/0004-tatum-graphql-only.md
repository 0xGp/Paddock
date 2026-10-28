# ADR-0004: Tatum Sui access is GraphQL only

- **Status:** Accepted (supersedes the JSON-RPC parts of SPEC §4, §5 and risk R-6)
- **Date:** 2026-10-28

## Context
The spec (Oct 19) used Tatum JSON-RPC for settlement confirmation (`sui_getTransactionBlock`) and incoming-transfer polling (`suix_queryTransactionBlocks`), and GraphQL for builds and balances. gRPC-web was already ruled out (Tatum serves native gRPC only).

Verified on **Oct 28, 2026** with our own API key (plan header `x-ttm-plan: free;ratelimit=3;strategy=shared`):
- `POST https://sui-mainnet.gateway.tatum.io` with `sui_getChainIdentifier` → **`404 Not Found`**, with or without the key, with or without a trailing slash.
- `https://sui-mainnet.gateway.tatum.io/llms.txt` lists a single interface: `sui-mainnet-graphql`.
- GraphQL works: `chainIdentifier`, `checkpoint`, `transaction(digest) { effects { status checkpoint balanceChanges } }`, `address { balance(coinType) }`, `transactions(filter: { affectedAddress | sentAddress | afterCheckpoint })`, `simulateTransaction`, and the `executeTransaction` mutation are all in the schema.

## Decision
- All Sui reads and writes go through Tatum GraphQL at `https://sui-mainnet.gateway.tatum.io/graphql`.
- Server code uses `packages/chain` (typed `{ok, value} | {ok, error}` results, timeouts, retries with jitter, 429 handling). The browser goes through `/api/sui/graphql`, which adds `x-api-key`.
- Settlement confirmation: `transaction(digest)` → check `effects.status == SUCCESS` and the USDC `balanceChanges` for payer and payee.
- Incoming transfers: `transactions(filter: { affectedAddress, afterCheckpoint })` on demand.
- Drop `TATUM_SUI_RPC_URL` from the env.
- Free plan is **3 requests/second**: batch with `multiGetBalances` / `multiGetTransactionEffects`, cache balance chips for 30 s, and run CI integration tests serially.

## Consequences
- One transport and one client: less code, simpler tests.
- The `/status` page shows GraphQL calls only, which still shows real use of Tatum.
- The `SETUP_CHECKLIST` smoke test was wrong and is replaced by `pnpm tatum:smoke`.
- Open: whether `executeTransaction` through Tatum accepts zkLogin-signed gasless transactions. Test this on day 1 of settlement work (see ADR-0008).
