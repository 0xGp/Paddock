import { describe, expect, it } from "vitest";
import { checkTransfer, confirmTransfer, createTatum, normalizeAddress, type TxSummary } from "../src/index.ts";

const U = "0xdba3::usdc::USDC";
const A = `0x${"a".repeat(64)}`;
const B = `0x${"b".repeat(64)}`;
const tx = (over: Partial<TxSummary> = {}): TxSummary => ({
  digest: "D",
  status: "SUCCESS",
  checkpoint: 1,
  timestamp: null,
  balanceChanges: [
    { owner: A, coinType: U, amount: -10_000n },
    { owner: B, coinType: U, amount: 10_000n },
    { owner: A, coinType: "0x2::sui::SUI", amount: -2_000_000n },
  ],
  ...over,
});
const expected = { from: A, to: B, amount: 10_000n, coinType: U };

describe("checkTransfer", () => {
  it("accepts an exact transfer, ignoring gas", () => expect(checkTransfer(tx(), expected)).toEqual({ ok: true }));
  it("rejects a failed transaction", () => expect(checkTransfer(tx({ status: "FAILURE" }), expected)).toMatchObject({ ok: false }));
  it("rejects a wrong amount", () => expect(checkTransfer(tx(), { ...expected, amount: 20_000n })).toMatchObject({ ok: false, reason: expect.stringContaining("received") }));
  it("rejects a wrong payee", () => expect(checkTransfer(tx(), { ...expected, to: `0x${"c".repeat(64)}` })).toMatchObject({ ok: false }));
  it("rejects a different coin", () => expect(checkTransfer(tx(), { ...expected, coinType: "0x2::sui::SUI" })).toMatchObject({ ok: false }));
  it("rejects paying yourself", () => expect(checkTransfer(tx(), { ...expected, to: A })).toMatchObject({ ok: false, reason: expect.stringContaining("same") }));
  it("normalizes short and upper-case addresses", () => {
    expect(normalizeAddress("0x2")).toBe(`0x${"0".repeat(63)}2`);
    expect(checkTransfer(tx(), { ...expected, from: A.toUpperCase().replace("0X", "0x") })).toEqual({ ok: true });
  });
});

describe("confirmTransfer", () => {
  const body = (transaction: unknown) => new Response(JSON.stringify({ data: { transaction } }), { status: 200 });
  const found = {
    digest: "D",
    effects: {
      status: "SUCCESS",
      timestamp: "2026-10-31T10:00:00Z",
      checkpoint: { sequenceNumber: "9" },
      balanceChanges: { nodes: [{ amount: "-10000", owner: { address: A }, coinType: { repr: U } }, { amount: "10000", owner: { address: B }, coinType: { repr: U } }] },
    },
  };

  it("polls until the indexer has the digest, then confirms", async () => {
    let n = 0;
    const fetch = (async () => (++n < 3 ? body(null) : body(found))) as unknown as typeof globalThis.fetch;
    const r = await confirmTransfer(createTatum({ url: "u", apiKey: "k", fetch, minIntervalMs: 0 }), "D", expected, { pollMs: 10, waitMs: 1000 });
    expect(r).toMatchObject({ ok: true, value: { digest: "D", checkpoint: 9, amount: 10_000n } });
    expect(n).toBe(3);
  });

  it("gives up on a digest that never appears", async () => {
    const fetch = (async () => body(null)) as unknown as typeof globalThis.fetch;
    const r = await confirmTransfer(createTatum({ url: "u", apiKey: "k", fetch, minIntervalMs: 0 }), "D", expected, { pollMs: 10, waitMs: 50 });
    expect(r).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("reports a mismatch instead of confirming", async () => {
    const fetch = (async () => body(found)) as unknown as typeof globalThis.fetch;
    const r = await confirmTransfer(createTatum({ url: "u", apiKey: "k", fetch, minIntervalMs: 0 }), "D", { ...expected, amount: 1n });
    expect(r).toMatchObject({ ok: false, error: { kind: "mismatch" } });
  });
});
