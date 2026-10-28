import { describe, expect, it } from "vitest";
import { allocate, equalSplit } from "../src/index.ts";

describe("allocate with share weights", () => {
  it("splits three ways to the kobo", () => {
    expect(Object.fromEntries(allocate(3_000_000n, { a: 1, b: 1, c: 1 }))).toEqual({ a: 1_000_000n, b: 1_000_000n, c: 1_000_000n });
  });

  it("hands the leftover kobo out by member id", () => {
    expect(Object.fromEntries(allocate(100n, { c: 1, a: 1, b: 1 }))).toEqual({ a: 34n, b: 33n, c: 33n });
  });

  it("matches basis points when the shares are the same proportions", () => {
    const amount = 1_234_567n;
    expect(allocate(amount, { a: 1, b: 1, c: 2, d: 0 })).toEqual(allocate(amount, { a: 2_500, b: 2_500, c: 5_000, d: 0 }));
  });

  it("keeps basis-point splits exactly as before", () => {
    expect(Object.fromEntries(allocate(3_000_000n, equalSplit(["a", "b", "c"])))).toEqual({ a: 1_000_200n, b: 999_900n, c: 999_900n });
  });

  it("refuses weights that can't split anything", () => {
    expect(() => allocate(100n, { a: 0 })).toThrow();
    expect(() => allocate(100n, { a: 1.5 })).toThrow();
    expect(() => allocate(100n, { a: -1, b: 2 })).toThrow();
  });
});
