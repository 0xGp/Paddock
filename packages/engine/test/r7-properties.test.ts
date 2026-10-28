import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocate, minimalTransfers, netBalances, type Expense } from "../src/index.ts";

const MEMBERS = ["ada", "emeka", "godspower", "tolu"];

const splitArb = fc
  .subarray(MEMBERS, { minLength: 1 })
  .chain((ids) =>
    fc.array(fc.integer({ min: 1, max: 100 }), { minLength: ids.length, maxLength: ids.length }).map((raw) => {
      const total = raw.reduce((a, b) => a + b, 0);
      const bps = raw.map((r) => Math.floor((r * 10_000) / total));
      bps[0]! += 10_000 - bps.reduce((a, b) => a + b, 0);
      return Object.fromEntries(ids.map((id, i) => [id, bps[i]!]));
    }),
  );

const expenseArb = fc.record({
  amount: fc.bigInt({ min: 1n, max: 50_000_000n }),
  payerId: fc.constantFrom(...MEMBERS),
  split: splitArb,
});

const ledgerArb = fc.array(expenseArb, { maxLength: 40 }).map((rows) =>
  rows.map(
    (r, i): Expense => ({
      id: `e${i}`,
      date: "2026-10-01",
      amountMinor: r.amount,
      currency: "NGN",
      payerId: r.payerId,
      category: "other",
      description: "x",
      split: r.split,
    }),
  ),
);

describe("R7 properties", () => {
  it("allocate always sums to the amount", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), splitArb, (amount, split) => {
        const total = [...allocate(amount, split).values()].reduce((a, b) => a + b, 0n);
        expect(total).toBe(amount);
      }),
    );
  });

  it("nets sum to zero, transfers ≤ members − 1, and applying them settles everyone", () => {
    fc.assert(
      fc.property(ledgerArb, (ledger) => {
        const net = netBalances(ledger);
        expect([...net.values()].reduce((a, b) => a + b, 0n)).toBe(0n);

        const transfers = minimalTransfers(net);
        const nonZero = [...net.values()].filter((v) => v !== 0n).length;
        expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));

        const after = new Map(net);
        for (const t of transfers) {
          expect(t.amountMinor > 0n).toBe(true);
          after.set(t.from, after.get(t.from)! + t.amountMinor);
          after.set(t.to, after.get(t.to)! - t.amountMinor);
        }
        for (const v of after.values()) expect(v).toBe(0n);
      }),
    );
  });

  it("is deterministic regardless of expense order", () => {
    fc.assert(
      fc.property(ledgerArb, (ledger) => {
        const a = minimalTransfers(netBalances(ledger));
        const b = minimalTransfers(netBalances([...ledger].reverse()));
        expect(b).toEqual(a);
      }),
    );
  });
});
