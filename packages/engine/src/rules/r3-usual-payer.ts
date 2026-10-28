import { round } from "../stats.ts";
import type { Expense, MemberId } from "../types.ts";

export interface UsualPayer {
  memberId: MemberId;
  share: number;
  count: number;
  totalCount: number;
  paidMinor: bigint;
  totalMinor: bigint;
  strength: "strong" | "moderate";
}

/** R3: who usually pays in a category. `expenses` must already be one category within the 90-day window. */
export function findUsualPayer(expenses: readonly Expense[]): UsualPayer | null {
  if (expenses.length < 4) return null;

  const paid = new Map<MemberId, { minor: bigint; count: number }>();
  let totalMinor = 0n;
  for (const e of expenses) {
    const row = paid.get(e.payerId) ?? { minor: 0n, count: 0 };
    row.minor += e.amountMinor;
    row.count += 1;
    paid.set(e.payerId, row);
    totalMinor += e.amountMinor;
  }
  if (totalMinor === 0n) return null;

  const ranked = [...paid.entries()].sort(([idA, a], [idB, b]) =>
    a.minor === b.minor ? (idA < idB ? -1 : 1) : a.minor > b.minor ? -1 : 1,
  );
  const [memberId, top] = ranked[0]!;
  const share = round(Number((top.minor * 10_000n) / totalMinor) / 10_000, 4);
  if (share < 0.6 || top.count < 3) return null;

  return {
    memberId,
    share,
    count: top.count,
    totalCount: expenses.length,
    paidMinor: top.minor,
    totalMinor,
    strength: share >= 0.8 ? "strong" : "moderate",
  };
}
