import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import type { ExpectedTransfer } from "./settle.ts";

/** Minimum settlement (ADR-0008): 0.01 USDC. */
export const MIN_SETTLEMENT_MICRO = 10_000n;

/**
 * The settlement PTB (ADR-0008): withdraw `amount` of the coin from the payer (address balance
 * first, then coins) and deposit it into the payee's address balance with `balance::send_funds`.
 */
export function transferTx({ from, to, amount, coinType }: ExpectedTransfer): Transaction {
  if (amount < MIN_SETTLEMENT_MICRO) throw new Error(`below the ${MIN_SETTLEMENT_MICRO} minimum`);
  const tx = new Transaction();
  tx.setSender(from);
  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [coinType],
    arguments: [tx.balance({ type: coinType, balance: amount }), tx.pure.address(to)],
  });
  return tx;
}

/**
 * A Sui GraphQL client for Tatum: direct with the key on the server, or via `/api/sui/graphql` in
 * the browser. Pass `fetch` from `createTatum` so the SDK's parallel calls respect the rate limit.
 */
export function tatumSuiClient(opts: { url: string; apiKey?: string; fetch?: typeof fetch }) {
  return new SuiGraphQLClient({ url: opts.url, network: "mainnet", headers: opts.apiKey ? { "x-api-key": opts.apiKey } : {}, ...(opts.fetch ? { fetch: opts.fetch } : {}) });
}
