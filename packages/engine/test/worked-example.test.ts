import { describe, expect, it } from "vitest";
import {
  detectRecurrence,
  equalSplit,
  findUsualPayer,
  minimalTransfers,
  scoreReliability,
  suggestNextPayer,
  type Expense,
} from "../src/index.ts";

const MEMBERS = ["ada", "emeka", "godspower", "tolu"];
const naira = (n: number) => BigInt(n) * 100n;

const fuel: Expense[] = [
  ["2026-08-02", 25_000, "tolu"],
  ["2026-08-09", 24_000, "tolu"],
  ["2026-08-16", 26_000, "tolu"],
  ["2026-08-23", 25_000, "tolu"],
  ["2026-08-30", 27_000, "tolu"],
  ["2026-09-06", 25_000, "ada"],
].map(([date, amount, payerId], i) => ({
  id: `fuel-${i + 1}`,
  date: date as string,
  amountMinor: naira(amount as number),
  currency: "NGN",
  payerId: payerId as string,
  category: "fuel",
  description: "Generator diesel",
  split: equalSplit(MEMBERS),
}));

describe("SPEC §2.4 worked example", () => {
  it("R2: weekly fuel, confidence 0.96, next Sep 13 at ₦25k", () => {
    const r = detectRecurrence(fuel);
    expect(r).toMatchObject({
      cadence: "weekly",
      confidence: 0.96,
      nextExpectedDate: "2026-09-13",
      expectedAmountMinor: naira(25_000),
      shown: true,
    });
  });

  it("R3: Tolu usually covers fuel, 5 of 6, ₦127k of ₦152k, strong", () => {
    const r = findUsualPayer(fuel);
    expect(r).toMatchObject({ memberId: "tolu", count: 5, strength: "strong" });
    expect(r?.paidMinor).toBe(naira(127_000));
    expect(r?.totalMinor).toBe(naira(152_000));
    expect(r?.share).toBeCloseTo(0.8355, 4);
  });

  it("R6: next fuel is Emeka (ties with Godspower on ₦38k, broken by memberId), gap 25%", () => {
    const r = suggestNextPayer(fuel, findUsualPayer(fuel));
    expect(r).toMatchObject({ memberId: "emeka", gapBps: 2_500, shown: true });
    expect(r?.fairShareMinor).toBe(naira(38_000));
    expect(r?.ranking.map((x) => [x.memberId, x.gapMinor / 100n])).toEqual([
      ["emeka", 38_000n],
      ["godspower", 38_000n],
      ["ada", 13_000n],
      ["tolu", -89_000n],
    ]);
  });

  it("R7: nets G +40k, T +25k, A −15k, E −50k give 3 transfers", () => {
    const net = new Map([
      ["godspower", naira(40_000)],
      ["tolu", naira(25_000)],
      ["ada", naira(-15_000)],
      ["emeka", naira(-50_000)],
    ]);
    expect(minimalTransfers(net)).toEqual([
      { from: "emeka", to: "godspower", amountMinor: naira(40_000) },
      { from: "emeka", to: "tolu", amountMinor: naira(10_000) },
      { from: "ada", to: "tolu", amountMinor: naira(15_000) },
    ]);
  });

  it("R5: Emeka scores 35 (slow), Godspower 91 (fast)", () => {
    const emeka = scoreReliability([6, 9, 11, 8]);
    expect(emeka?.history).toEqual([6, 6.9, 8.13, 8.091]);
    expect(emeka).toMatchObject({ score: 35, label: "slow" });
    expect(scoreReliability([1, 0, 2])).toMatchObject({ score: 91, label: "fast" });
  });
});
