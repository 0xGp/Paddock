import { describe, expect, it } from "vitest";
import { buildFlatView, type Ledger } from "../src/index.ts";

const naira = (n: number) => BigInt(n) * 100n;
const MEMBERS = ["ada", "emeka", "tolu"];

const base: Ledger = {
  members: MEMBERS.map((id) => ({ id, displayName: id[0]!.toUpperCase() + id.slice(1) })),
  expenses: [
    { id: "e1", date: "2026-10-01", amountMinor: naira(40_000), currency: "NGN", payerId: "ada", category: "fuel", description: "Diesel", split: { ada: 5_000, emeka: 2_500, tolu: 2_500 } },
  ],
  settlements: [],
};

const net = (ledger: Ledger, asOf = "2026-10-31") =>
  Object.fromEntries(buildFlatView(ledger, asOf).balances.map((b) => [b.memberId, b.netMinor]));

describe("on-chain payments", () => {
  it("move net balances from payer to payee", () => {
    const after = net({ ...base, payments: [{ id: "tx1", from: "emeka", to: "ada", amountMinor: naira(4_000), paidOn: "2026-10-28" }] });
    expect(after).toEqual({ ada: naira(16_000), emeka: naira(-6_000), tolu: naira(-10_000) });
  });

  it("a full payment removes the transfer", () => {
    const view = buildFlatView({ ...base, payments: [{ id: "tx1", from: "emeka", to: "ada", amountMinor: naira(10_000), paidOn: "2026-10-28" }] }, "2026-10-31");
    expect(view.transfers.map((t) => [t.from, t.to, t.amountMinor])).toEqual([["tolu", "ada", naira(10_000)]]);
  });

  it("explains what was already paid", () => {
    const view = buildFlatView({ ...base, payments: [{ id: "tx1", from: "emeka", to: "ada", amountMinor: naira(4_000), paidOn: "2026-10-28" }] }, "2026-10-31");
    const emeka = view.transfers.find((t) => t.from === "emeka")!;
    expect(emeka.explanation.facts).toContainEqual({ label: "Emeka already paid on Sui", value: "₦4,000" });
  });

  it("ignores payments after asOf and payments to yourself", () => {
    const ledger = {
      ...base,
      payments: [
        { id: "late", from: "emeka", to: "ada", amountMinor: naira(4_000), paidOn: "2026-11-02" },
        { id: "self", from: "tolu", to: "tolu", amountMinor: naira(1_000), paidOn: "2026-10-28" },
      ],
    };
    expect(net(ledger)).toEqual(net(base));
  });

  it("totals still sum to zero", () => {
    const after = net({ ...base, payments: [{ id: "tx1", from: "tolu", to: "ada", amountMinor: naira(12_345), paidOn: "2026-10-02" }] });
    expect(Object.values(after).reduce((s, v) => s + v, 0n)).toBe(0n);
  });
});
