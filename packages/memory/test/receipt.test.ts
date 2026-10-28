import { describe, expect, it } from "vitest";
import { groupNamespace, isNewKnowledge, materialHash, open, receiptDraft, reduceLearned, sealAll } from "../src/index.ts";

const ns = groupNamespace("flat-3b", "test-salt-0123456789");
const AT = "2026-10-28T18:00:00.000Z";
const base = {
  from: "emeka",
  to: "godspower",
  fromAddress: `0x${"b".repeat(64)}`,
  toAddress: `0x${"a".repeat(64)}`,
  microUsdc: 10_000n,
  rateNgnPerUsdc: 1500,
  coinType: "0xdba3::usdc::USDC",
  digest: "FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2",
  checkpoint: "339135513",
  settledAt: "2026-10-28T17:55:00.256Z",
  expenseIds: [],
};

describe("settlement receipts", () => {
  it("converts USDC back to NGN at the group rate, one memory per digest", () => {
    const d = receiptDraft(base);
    expect(d).toMatchObject({ kind: "settlement_receipt", subject: base.digest, data: { microUsdc: "10000", amountMinor: "1500", confirmedBy: "tatum-graphql" } });
  });

  it("seals, verifies and is read back by digest", () => {
    const [s] = sealAll([receiptDraft(base)], ns, new Map(), AT).sealed;
    expect(open(s!.text, ns).ok).toBe(true);
    const state = reduceLearned(ns, [{ text: s!.text, blob_id: "blob1" }]);
    expect(state.receipts[base.digest]?.data).toMatchObject({ from: "emeka", to: "godspower", digest: base.digest, amountMinor: "1500" });
    expect(state.history).toHaveLength(0);
  });

  it("is never written twice for the same transaction", () => {
    const d = receiptDraft(base);
    expect(isNewKnowledge(d, { materialHash: materialHash(d), asOf: null })).toBe(false);
  });

  it("rejects an address that isn't a full Sui address", () => {
    expect(() => sealAll([receiptDraft({ ...base, toAddress: "0x2" })], ns, new Map(), AT)).toThrow();
  });
});
