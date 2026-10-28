import { daysBetween } from "./dates.ts";
import { allocate, formatNaira } from "./money.ts";
import { detectRecurrence, type Cadence } from "./rules/r2-recurrence.ts";
import { findUsualPayer, type UsualPayer } from "./rules/r3-usual-payer.ts";
import { scoreReliability, type ReliabilityLabel } from "./rules/r5-reliability.ts";
import { suggestNextPayer } from "./rules/r6-rotation.ts";
import { minimalTransfers } from "./rules/r7-balances.ts";
import type { Category, Expense, Explanation, LocalDate, MemberId } from "./types.ts";

export interface Member {
  id: MemberId;
  displayName: string;
}

export interface Settlement {
  expenseId: string;
  memberId: MemberId;
  settledOn: LocalDate;
}

/** A confirmed on-chain payment between members, in naira at the group rate. */
export interface Payment {
  id: string;
  from: MemberId;
  to: MemberId;
  amountMinor: bigint;
  paidOn: LocalDate;
}

export interface Ledger {
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  payments?: Payment[];
}

export interface BalanceRow {
  memberId: MemberId;
  netMinor: bigint;
}

export interface TransferRow {
  from: MemberId;
  to: MemberId;
  amountMinor: bigint;
  explanation: Explanation;
}

export interface TurnRow {
  category: Category;
  usualPayer: UsualPayer;
  nextPayerId: MemberId;
  explanation: Explanation;
}

export interface UpcomingRow {
  category: Category;
  description: string;
  cadence: Cadence;
  nextExpectedDate: LocalDate;
  expectedAmountMinor: bigint;
  confidence: number;
  explanation: Explanation;
}

export interface ReliabilityRow {
  memberId: MemberId;
  score: number;
  label: ReliabilityLabel;
  medianDelay: number;
  ewmaDelay: number;
  settledCount: number;
  explanation: Explanation;
}

export interface FlatView {
  asOf: LocalDate;
  balances: BalanceRow[];
  transfers: TransferRow[];
  turns: TurnRow[];
  upcoming: UpcomingRow[];
  reliability: ReliabilityRow[];
}

const CATEGORY_LABEL: Record<Category, string> = {
  fuel: "diesel",
  power: "power",
  data: "data",
  groceries: "groceries",
  housing: "service charge",
  utilities: "waste",
  food: "food",
  transport: "transport",
  tickets: "tickets",
  stay: "accommodation",
  other: "other",
};

const pct = (share: number) => `${Math.round(share * 100)}%`;
const byId = (a: { memberId: MemberId }, b: { memberId: MemberId }) => (a.memberId < b.memberId ? -1 : 1);

/** Everything the group dashboard shows, derived deterministically from the ledger as of `asOf`. */
export function buildFlatView(ledger: Ledger, asOf: LocalDate): FlatView {
  const name = (id: MemberId) => ledger.members.find((m) => m.id === id)?.displayName ?? id;
  const expenses = ledger.expenses.filter((e) => e.date <= asOf);
  const settled = new Set(
    ledger.settlements.filter((s) => s.settledOn <= asOf).map((s) => `${s.expenseId}:${s.memberId}`),
  );

  // R7 over open edges only.
  const net = new Map<MemberId, bigint>(ledger.members.map((m) => [m.id, 0n]));
  const openEvidence = new Map<MemberId, string[]>();
  for (const e of expenses) {
    for (const [memberId, share] of allocate(e.amountMinor, e.split)) {
      if (memberId === e.payerId || share === 0n || settled.has(`${e.id}:${memberId}`)) continue;
      net.set(memberId, (net.get(memberId) ?? 0n) - share);
      net.set(e.payerId, (net.get(e.payerId) ?? 0n) + share);
      openEvidence.set(memberId, [...(openEvidence.get(memberId) ?? []), e.id]);
    }
  }
  const paid = new Map<MemberId, bigint>();
  for (const p of ledger.payments ?? []) {
    if (p.paidOn > asOf || p.from === p.to) continue;
    net.set(p.from, (net.get(p.from) ?? 0n) + p.amountMinor);
    net.set(p.to, (net.get(p.to) ?? 0n) - p.amountMinor);
    paid.set(p.from, (paid.get(p.from) ?? 0n) + p.amountMinor);
  }
  const balances = [...net].map(([memberId, netMinor]) => ({ memberId, netMinor })).sort(byId);
  const transfers = minimalTransfers(net).map((t) => ({
    ...t,
    explanation: {
      summary: `${name(t.from)} pays ${name(t.to)} ${formatNaira(t.amountMinor)}`,
      facts: [
        { label: `${name(t.from)} owes in total`, value: formatNaira(-(net.get(t.from) ?? 0n)) },
        { label: `${name(t.to)} is owed in total`, value: formatNaira(net.get(t.to) ?? 0n) },
        { label: "Unsettled entries", value: String(openEvidence.get(t.from)?.length ?? 0) },
        ...(paid.get(t.from) ? [{ label: `${name(t.from)} already paid on Sui`, value: formatNaira(paid.get(t.from)!) }] : []),
      ],
      formula: paid.size
        ? "net = paid − owed over unsettled shares + sent − received on Sui; largest debtor pays largest creditor first"
        : "net = paid − owed over unsettled shares; largest debtor pays largest creditor first",
      threshold: "At most members − 1 payments",
      evidenceExpenseIds: openEvidence.get(t.from) ?? [],
    },
  }));

  const categories = [...new Set(expenses.map((e) => e.category))].sort();
  const within = (days: number) => (e: Expense) => {
    const age = daysBetween(e.date, asOf);
    return age >= 0 && age < days;
  };

  // R3 + R6: whose turn.
  const turns: TurnRow[] = [];
  for (const category of categories) {
    const recent = expenses.filter((e) => e.category === category).filter(within(90));
    const usual = findUsualPayer(recent);
    const next = suggestNextPayer(recent, usual);
    if (!usual || !next?.shown) continue;
    const label = CATEGORY_LABEL[category];
    turns.push({
      category,
      usualPayer: usual,
      nextPayerId: next.memberId,
      explanation: {
        summary: `${name(usual.memberId)} has covered ${label} ${usual.count} of ${usual.totalCount} times. Next ${label}: ${name(next.memberId)}?`,
        facts: [
          { label: `${name(usual.memberId)} paid`, value: `${formatNaira(usual.paidMinor)} of ${formatNaira(usual.totalMinor)} (${pct(usual.share)})` },
          { label: "Fair share each", value: formatNaira(next.fairShareMinor) },
          ...next.ranking.map((r) => ({
            label: `${name(r.memberId)} is behind by`,
            value: r.gapMinor > 0n ? formatNaira(r.gapMinor) : `ahead by ${formatNaira(-r.gapMinor)}`,
          })),
        ],
        formula: "gap = fair share − paid; next payer = largest gap, then longest since last paid, then name",
        threshold: "Usual payer ≥ 60% over ≥ 3 entries; top gap ≥ 15% of 90-day spend",
        evidenceExpenseIds: recent.map((e) => e.id),
      },
    });
  }

  // R2: upcoming bills, one series per category over 180 days.
  const upcoming: UpcomingRow[] = [];
  for (const category of categories) {
    const series = expenses.filter((e) => e.category === category).filter(within(180));
    const r = detectRecurrence(series);
    if (!r?.shown) continue;
    const description = series.at(-1)!.description;
    upcoming.push({
      category,
      description,
      cadence: r.cadence,
      nextExpectedDate: r.nextExpectedDate,
      expectedAmountMinor: r.expectedAmountMinor,
      confidence: r.confidence,
      explanation: {
        summary: `${description} comes ${r.cadence}, next around ${r.nextExpectedDate}, usually ${formatNaira(r.expectedAmountMinor)}`,
        facts: [
          { label: "Entries seen", value: String(r.n) },
          { label: "Typical gap", value: `${r.medianGapDays} days` },
          { label: "Gap variation (CV)", value: r.cvGap.toFixed(2) },
          { label: "Amount variation (CV)", value: r.cvAmount.toFixed(2) },
          { label: "Confidence", value: r.confidence.toFixed(2) },
        ],
        formula: "confidence = min(1, n/6) × (1 − CV gap) × (1 − CV amount)",
        threshold: "n ≥ 3, CV gap ≤ 0.25, CV amount ≤ 0.20, shown at confidence ≥ 0.5",
        evidenceExpenseIds: series.map((e) => e.id),
      },
    });
  }
  upcoming.sort((a, b) => (a.nextExpectedDate === b.nextExpectedDate ? (a.category < b.category ? -1 : 1) : a.nextExpectedDate < b.nextExpectedDate ? -1 : 1));

  // R5: settle speed over 120 days, in settlement order.
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const reliability: ReliabilityRow[] = [];
  for (const m of ledger.members) {
    const mine = ledger.settlements
      .filter((s) => s.memberId === m.id && s.settledOn <= asOf && daysBetween(s.settledOn, asOf) < 120)
      .sort((a, b) => (a.settledOn === b.settledOn ? (a.expenseId < b.expenseId ? -1 : 1) : a.settledOn < b.settledOn ? -1 : 1));
    const delays = mine.flatMap((s) => {
      const e = expenseById.get(s.expenseId);
      return e ? [daysBetween(e.date, s.settledOn)] : [];
    });
    const r = scoreReliability(delays);
    if (!r) continue;
    reliability.push({
      memberId: m.id,
      score: r.score,
      label: r.label,
      medianDelay: r.medianDelay,
      ewmaDelay: r.ewmaDelay,
      settledCount: delays.length,
      explanation: {
        summary: `${m.displayName} usually settles in about ${r.medianDelay} days (${r.label})`,
        facts: [
          { label: "Shares settled", value: String(delays.length) },
          { label: "Typical delay", value: `${r.medianDelay} days` },
          { label: "Recent-weighted delay", value: `${r.ewmaDelay.toFixed(1)} days` },
          { label: "Score", value: `${r.score} / 100` },
        ],
        formula: "ewma = 0.3 × delay + 0.7 × previous; score = 100 − 8 × ewma",
        threshold: "fast ≥ 80, steady 50–79, slow < 50",
        evidenceExpenseIds: mine.map((s) => s.expenseId),
      },
    });
  }
  reliability.sort((a, b) => (a.score === b.score ? (a.memberId < b.memberId ? -1 : 1) : b.score - a.score));

  return { asOf, balances, transfers, turns, upcoming, reliability };
}
