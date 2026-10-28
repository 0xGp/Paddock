import { describe, expect, it } from "vitest";
import { parseQuickEntry, type MemberNames } from "../src/index.ts";

const members: MemberNames[] = [
  { id: "godspower", names: ["Godspower", "GP"] },
  { id: "tolu", names: ["Tolu"] },
  { id: "ada", names: ["Ada"] },
  { id: "emeka", names: ["Emeka", "Meks"] },
];
const parse = (line: string) => parseQuickEntry(line, members, "godspower");

describe("R0 quick entry (SPEC examples)", () => {
  it("25k diesel tolu paid", () => {
    expect(parse("25k diesel tolu paid")).toEqual({
      ok: true,
      amountMinor: 2_500_000n,
      description: "diesel",
      payerId: "tolu",
      participants: null,
    });
  });

  it("₦4,500 LAWMA — me", () => {
    expect(parse("₦4,500 LAWMA — me")).toMatchObject({ ok: true, amountMinor: 450_000n, description: "LAWMA", payerId: "godspower" });
  });

  it("shoprite 38k split ada emeka", () => {
    expect(parse("shoprite 38k split ada emeka")).toMatchObject({
      ok: true,
      amountMinor: 3_800_000n,
      description: "shoprite",
      payerId: null,
      participants: ["ada", "emeka"],
    });
  });

  it("matches learned nicknames and 'paid by'", () => {
    expect(parse("paid by meks 1.5k suya")).toMatchObject({ ok: true, amountMinor: 150_000n, payerId: "emeka", description: "suya" });
  });

  it("rejects lines without an amount and sub-kobo amounts", () => {
    expect(parse("diesel tolu paid")).toMatchObject({ ok: false });
    expect(parse("₦1.005 gum")).toMatchObject({ ok: false });
  });
});
