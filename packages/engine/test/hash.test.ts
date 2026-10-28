import { describe, expect, it } from "vitest";
import { canonicalJSON, hashOf, inputsHash, learnedHash, ledgerHash, sha256Hex } from "../src/index.ts";
import { ledger } from "./fixture.ts";

describe("canonicalJSON", () => {
  it("sorts keys at every depth and drops undefined", () => {
    expect(canonicalJSON({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
  });

  it("serialises bigint as a decimal string", () => {
    expect(canonicalJSON({ amount: 2_500_000n })).toBe('{"amount":"2500000"}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJSON({ x: Number.NaN })).toThrow();
  });
});

describe("hashes", () => {
  it("sha256Hex matches the known vector", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("ledgerHash ignores row order", () => {
    const shuffled = { expenses: ledger.expenses.toReversed(), settlements: ledger.settlements.toReversed() };
    expect(ledgerHash(shuffled)).toBe(ledgerHash(ledger));
  });

  it("ledgerHash changes when one kobo changes", () => {
    const [first, ...rest] = ledger.expenses;
    const tampered = { ...ledger, expenses: [{ ...first!, amountMinor: first!.amountMinor + 1n }, ...rest] };
    expect(ledgerHash(tampered)).not.toBe(ledgerHash(ledger));
  });

  it("learnedHash is key-order independent and inputsHash excludes time", () => {
    expect(learnedHash({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(inputsHash("l", "m", "v1")).toBe(inputsHash("l", "m", "v1"));
  });
});
