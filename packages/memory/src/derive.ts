import { ledgerHash, RULESET_VERSION, type Explanation, type FlatView, type Ledger } from "@splitsense/engine";
import type { Draft, KindData } from "./envelope.ts";

type Insight = KindData<"pattern_snapshot">;

const insight = (ruleId: string, asOf: string, hash: string, output: Insight["output"], e: Explanation): Insight => ({
  ruleId,
  asOf,
  summary: e.summary,
  output,
  facts: e.facts,
  formula: e.formula,
  threshold: e.threshold,
  ledgerHash: hash,
  rulesetVersion: RULESET_VERSION,
});

/** What the engine learned as of `view.asOf`, as one memory per (kind, subject). */
export function insightDrafts(ledger: Ledger, view: FlatView): Draft[] {
  const visible = { expenses: ledger.expenses.filter((e) => e.date <= view.asOf), settlements: ledger.settlements.filter((s) => s.settledOn <= view.asOf) };
  const hash = ledgerHash(visible);
  return [
    ...view.turns.map((t): Draft<"pattern_snapshot"> => ({
      kind: "pattern_snapshot",
      subject: `turn.${t.category}`,
      data: insight("R3R6", view.asOf, hash, {
        category: t.category,
        usualPayerId: t.usualPayer.memberId,
        usualCount: t.usualPayer.count,
        totalCount: t.usualPayer.totalCount,
        nextPayerId: t.nextPayerId,
      }, t.explanation),
    })),
    ...view.upcoming.map((u): Draft<"pattern_snapshot"> => ({
      kind: "pattern_snapshot",
      subject: `bill.${u.category}`,
      data: insight("R2", view.asOf, hash, {
        category: u.category,
        description: u.description,
        cadence: u.cadence,
        nextExpectedDate: u.nextExpectedDate,
        expectedAmountMinor: u.expectedAmountMinor.toString(),
        confidence: Number(u.confidence.toFixed(4)),
      }, u.explanation),
    })),
    ...view.reliability.map((r): Draft<"member_habit"> => ({
      kind: "member_habit",
      subject: r.memberId,
      data: insight("R5", view.asOf, hash, {
        score: r.score,
        label: r.label,
        medianDelay: r.medianDelay,
        ewmaDelay: Number(r.ewmaDelay.toFixed(4)),
        settledCount: r.settledCount,
      }, r.explanation),
    })),
  ];
}

/** Records that something learned earlier no longer meets its threshold as of `asOf`. */
export function retiredDraft<K extends "pattern_snapshot" | "member_habit">(last: Draft<K>, asOf: string): Draft<K> {
  const d = last.data as Insight;
  return {
    kind: last.kind,
    subject: last.subject,
    data: {
      ...d,
      asOf,
      summary: `No longer holds as of ${asOf}: ${d.summary}`,
      output: { ...d.output, retired: true },
      facts: [{ label: "Last seen", value: d.asOf }],
    } as KindData<K>,
  };
}

export function profileDraft(ledger: Ledger, rateNgnPerUsdc: number): Draft<"group_profile"> {
  return {
    kind: "group_profile",
    subject: "group",
    data: { members: ledger.members.map(({ id, displayName }) => ({ id, displayName })), baseCurrency: "NGN", rateNgnPerUsdc, rulesetVersion: RULESET_VERSION },
  };
}

/** A settlement Tatum has confirmed, one memory per transaction digest. */
export function receiptDraft(r: Omit<KindData<"settlement_receipt">, "confirmedBy" | "amountMinor" | "microUsdc"> & { microUsdc: bigint; rateNgnPerUsdc: number }): Draft<"settlement_receipt"> {
  const { rateNgnPerUsdc, microUsdc, ...rest } = r;
  const amountMinor = (microUsdc * BigInt(rateNgnPerUsdc) * 100n) / 1_000_000n;
  return { kind: "settlement_receipt", subject: r.digest, data: { ...rest, microUsdc: microUsdc.toString(), amountMinor: amountMinor.toString(), confirmedBy: "tatum-graphql" } };
}

/**
 * The ledger in chunks of `size` expenses (date order), each carrying the settlements of its
 * expenses and the hash of everything up to and including the chunk, so restore can verify.
 */
export function checkpointDrafts(ledger: Ledger, size = 10): Draft<"ledger_checkpoint">[] {
  const sorted = ledger.expenses.toSorted((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  const drafts: Draft<"ledger_checkpoint">[] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    const ids = new Set(chunk.map((e) => e.id));
    const upTo = sorted.slice(0, i + size);
    const upToIds = new Set(upTo.map((e) => e.id));
    drafts.push({
      kind: "ledger_checkpoint",
      subject: `ledger.${String(i / size).padStart(3, "0")}`,
      data: {
        expenses: chunk.map((e) => ({ ...e, amountMinor: e.amountMinor.toString() })),
        settlements: ledger.settlements.filter((s) => ids.has(s.expenseId)),
        entryCount: upTo.length,
        ledgerHash: ledgerHash({ expenses: upTo, settlements: ledger.settlements.filter((s) => upToIds.has(s.expenseId)) }),
      },
    });
  }
  return drafts;
}
