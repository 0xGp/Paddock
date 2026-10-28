import { describe, expect, it } from "vitest";
import { buildFlatView, formatNaira } from "../src/index.ts";
import { asOf, ledger } from "./fixture.ts";

const view = buildFlatView(ledger, asOf);
const naira = (n: number) => BigInt(n) * 100n;

describe("Flat 3B golden view (fixtures/lagos-flat.json, as of 2026-11-01)", () => {
  it("open balances net to zero and Emeka owes ₦15,750", () => {
    expect(view.balances.reduce((s, b) => s + b.netMinor, 0n)).toBe(0n);
    expect(view.balances.find((b) => b.memberId === "emeka")?.netMinor).toBe(naira(-15_750));
  });

  it("settle-up is two payments from Emeka", () => {
    expect(view.transfers.map(({ from, to, amountMinor }) => ({ from, to, amountMinor }))).toEqual([
      { from: "emeka", to: "ada", amountMinor: naira(9_750) },
      { from: "emeka", to: "tolu", amountMinor: naira(6_000) },
    ]);
  });

  it("whose turn: Tolu usually covers diesel, next is Godspower", () => {
    expect(view.turns).toHaveLength(1);
    expect(view.turns[0]).toMatchObject({ category: "fuel", nextPayerId: "godspower", usualPayer: { memberId: "tolu", count: 9 } });
  });

  it("upcoming bills: diesel due today, power on Nov 11", () => {
    expect(view.upcoming.map((u) => [u.category, u.cadence, u.nextExpectedDate, u.confidence])).toEqual([
      ["fuel", "weekly", "2026-11-01", 0.97],
      ["utilities", "monthly", "2026-11-01", 0.5],
      ["data", "monthly", "2026-11-06", 0.5],
      ["power", "biweekly", "2026-11-11", 0.94],
    ]);
  });

  it("settle speed: Godspower fast, Emeka slow", () => {
    expect(view.reliability.map((r) => [r.memberId, r.score, r.label])).toEqual([
      ["godspower", 95, "fast"],
      ["tolu", 72, "steady"],
      ["ada", 58, "steady"],
      ["emeka", 31, "slow"],
    ]);
  });

  it("formats negative naira with a leading minus", () => {
    expect(formatNaira(naira(-15_750))).toBe("−₦15,750");
  });
});
