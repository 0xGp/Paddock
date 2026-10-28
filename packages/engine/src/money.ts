import type { MemberId } from "./types.ts";

export const BPS_TOTAL = 10_000;

/**
 * Splits `amount` by whole-number weights (basis points, or one share each). Remainders
 * from integer division go one unit at a time to the largest fractional parts, ties by
 * memberId ascending, so the parts always sum to `amount` exactly.
 */
export function allocate(amount: bigint, split: Record<MemberId, number>): Map<MemberId, bigint> {
  const entries = Object.entries(split).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.some(([, w]) => !Number.isInteger(w) || w < 0)) throw new Error("Split weights must be whole numbers ≥ 0");
  const total = BigInt(entries.reduce((sum, [, w]) => sum + w, 0));
  if (total === 0n) throw new Error("Split weights sum to 0");

  const parts = new Map<MemberId, bigint>();
  const remainders: Array<{ id: MemberId; rem: bigint }> = [];
  let assigned = 0n;
  for (const [id, w] of entries) {
    const scaled = amount * BigInt(w);
    const part = scaled / total;
    parts.set(id, part);
    remainders.push({ id, rem: scaled % total });
    assigned += part;
  }

  remainders.sort((a, b) => (a.rem === b.rem ? (a.id < b.id ? -1 : 1) : a.rem > b.rem ? -1 : 1));
  let left = amount - assigned;
  for (const { id } of remainders) {
    if (left === 0n) break;
    parts.set(id, parts.get(id)! + 1n);
    left -= 1n;
  }
  return parts;
}

export function equalSplit(members: readonly MemberId[]): Record<MemberId, number> {
  const sorted = [...members].sort();
  const base = Math.floor(BPS_TOTAL / sorted.length);
  const split: Record<MemberId, number> = {};
  sorted.forEach((id, i) => {
    split[id] = base + (i < BPS_TOTAL - base * sorted.length ? 1 : 0);
  });
  return split;
}

/** NGN kobo → micro-USDC at a group rate (₦ per 1 USDC). Rounds down (ADR-0008). */
export function koboToMicroUsdc(kobo: bigint, rateNgnPerUsdc: bigint): bigint {
  return (kobo * 1_000_000n) / (rateNgnPerUsdc * 100n);
}

export function formatNaira(kobo: bigint): string {
  const sign = kobo < 0n ? "−" : "";
  const abs = kobo < 0n ? -kobo : kobo;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const k = abs % 100n;
  return k === 0n ? `${sign}₦${whole}` : `${sign}₦${whole}.${k.toString().padStart(2, "0")}`;
}
