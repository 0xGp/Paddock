import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Ledger } from "./flat-view.ts";

/** Deterministic JSON: sorted keys, bigint as decimal string, undefined fields dropped. */
export function canonicalJSON(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "bigint":
      return JSON.stringify(value.toString());
    case "number":
      if (!Number.isFinite(value)) throw new Error(`canonicalJSON: non-finite number ${value}`);
      return JSON.stringify(value);
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJSON(v))).join(",")}]`;
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(",")}}`;
    }
    default:
      throw new Error(`canonicalJSON: unsupported type ${typeof value}`);
  }
}

export const sha256Hex = (text: string): string => bytesToHex(sha256(utf8ToBytes(text)));

export const hashOf = (value: unknown): string => sha256Hex(canonicalJSON(value));

/** sha256 over the ledger's expenses and settlements, order-independent (ADR-0006). */
export function ledgerHash(ledger: Pick<Ledger, "expenses" | "settlements">): string {
  const expenses = ledger.expenses.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const settlements = ledger.settlements.toSorted((a, b) =>
    a.expenseId === b.expenseId ? (a.memberId < b.memberId ? -1 : 1) : a.expenseId < b.expenseId ? -1 : 1,
  );
  return hashOf({ expenses, settlements });
}

/** sha256 over the learned state recalled from memory (ADR-0006). */
export const learnedHash = (learned: unknown): string => hashOf(learned);

/** `now` is deliberately not an input (ADR-0006). */
export const inputsHash = (ledgerH: string, learnedH: string, rulesetVersion: string): string =>
  sha256Hex(`${ledgerH}:${learnedH}:${rulesetVersion}`);
