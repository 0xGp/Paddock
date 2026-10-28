import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confirmTransfer, createTatum, getBalance, getChainHead, getTransaction, SUI_MAINNET_CHAIN_ID, USDC_MAINNET_COIN_TYPE } from "../src/index.ts";

const envFile = new URL("../../../.env.local", import.meta.url);
if (process.env.TATUM_LIVE === "1" && !process.env.TATUM_API_KEY && existsSync(envFile)) process.loadEnvFile(envFile);

const KNOWN_DIGEST = process.env.STATUS_KNOWN_DIGEST || "9BP3cyBReBTmWxDWzDP7TuTNyzsL9VMV7he9rP4mwAYx";

/** Real Tatum Mainnet calls. Opt-in (`pnpm test:live`) so unit runs never touch the network. */
describe.skipIf(process.env.TATUM_LIVE !== "1")("Tatum Sui Mainnet GraphQL (live)", () => {
  const tatum = createTatum({ url: process.env.TATUM_SUI_GRAPHQL_URL || "https://sui-mainnet.gateway.tatum.io/graphql", apiKey: process.env.TATUM_API_KEY ?? "" });

  it("is Sui Mainnet with a fresh checkpoint", async () => {
    const r = await getChainHead(tatum);
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
    if (!r.ok) return;
    expect(r.value.chainId).toBe(SUI_MAINNET_CHAIN_ID);
    expect(Date.now() - Date.parse(r.value.timestamp ?? "")).toBeLessThan(5 * 60_000);
  });

  it("reads a known USDC transfer's balance changes and the recipient's balance", async () => {
    const tx = await getTransaction(tatum, KNOWN_DIGEST);
    expect(tx.ok, tx.ok ? "" : tx.error.message).toBe(true);
    if (!tx.ok) return;
    expect(tx.value.status).toBe("SUCCESS");
    const usdc = tx.value.balanceChanges.filter((b) => b.coinType === USDC_MAINNET_COIN_TYPE);
    expect(usdc.reduce((s, b) => s + b.amount, 0n)).toBe(0n);
    const to = usdc.find((b) => b.amount > 0n)?.owner;
    expect(to).toMatch(/^0x[0-9a-f]{64}$/);
    const bal = await getBalance(tatum, to!, USDC_MAINNET_COIN_TYPE);
    expect(bal.ok).toBe(true);
  });

  it("confirms that transfer the way a settlement is confirmed", async () => {
    const tx = await getTransaction(tatum, KNOWN_DIGEST);
    if (!tx.ok) throw new Error(tx.error.message);
    const usdc = tx.value.balanceChanges.filter((b) => b.coinType === USDC_MAINNET_COIN_TYPE);
    const from = usdc.find((b) => b.amount < 0n)!;
    const to = usdc.find((b) => b.amount > 0n)!;
    const r = await confirmTransfer(tatum, KNOWN_DIGEST, { from: from.owner!, to: to.owner!, amount: to.amount, coinType: USDC_MAINNET_COIN_TYPE });
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });
});
