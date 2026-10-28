import type { Expense, MemberId } from "../types.ts";
import type { UsualPayer } from "./r3-usual-payer.ts";

export interface RotationSuggestion {
  memberId: MemberId;
  gapMinor: bigint;
  fairShareMinor: bigint;
  totalMinor: bigint;
  /** Top gap as basis points of the category's spend. */
  gapBps: number;
  shown: boolean;
  ranking: Array<{ memberId: MemberId; gapMinor: bigint; lastPaid: string | null }>;
}

/**
 * R6(b): suggests whose turn it is in a category. `expenses` are one category within 90 days.
 * Participants are everyone who paid or was split into the category. Ties: largest gap,
 * then longest since last paid (never paid first), then memberId.
 */
export function suggestNextPayer(
  expenses: readonly Expense[],
  usualPayer: UsualPayer | null,
  minGapBps = 1_500,
): RotationSuggestion | null {
  if (expenses.length === 0) return null;

  const participants = new Set<MemberId>();
  const paid = new Map<MemberId, bigint>();
  const lastPaid = new Map<MemberId, string>();
  let totalMinor = 0n;
  for (const e of expenses) {
    participants.add(e.payerId);
    for (const id of Object.keys(e.split)) participants.add(id);
    paid.set(e.payerId, (paid.get(e.payerId) ?? 0n) + e.amountMinor);
    const prev = lastPaid.get(e.payerId);
    if (!prev || e.date > prev) lastPaid.set(e.payerId, e.date);
    totalMinor += e.amountMinor;
  }

  const fairShareMinor = totalMinor / BigInt(participants.size);
  const ranking = [...participants]
    .map((memberId) => ({
      memberId,
      gapMinor: fairShareMinor - (paid.get(memberId) ?? 0n),
      lastPaid: lastPaid.get(memberId) ?? null,
    }))
    .sort((a, b) => {
      if (a.gapMinor !== b.gapMinor) return a.gapMinor > b.gapMinor ? -1 : 1;
      if (a.lastPaid !== b.lastPaid) {
        if (a.lastPaid === null) return -1;
        if (b.lastPaid === null) return 1;
        return a.lastPaid < b.lastPaid ? -1 : 1;
      }
      return a.memberId < b.memberId ? -1 : 1;
    });

  const top = ranking[0]!;
  const gapBps = totalMinor === 0n ? 0 : Number((top.gapMinor * 10_000n) / totalMinor);
  return {
    memberId: top.memberId,
    gapMinor: top.gapMinor,
    fairShareMinor,
    totalMinor,
    gapBps,
    shown: usualPayer !== null && gapBps >= minGapBps,
    ranking,
  };
}
