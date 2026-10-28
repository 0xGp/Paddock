import { buildFlatView, type Ledger } from "@splitsense/engine";
import { checkpointDrafts, insightDrafts, profileDraft, retiredDraft } from "./derive.ts";
import type { Draft } from "./envelope.ts";

export interface SeedPhase {
  asOf: string;
  drafts: Draft[];
}

/**
 * The group's history replayed as phases: profile first, then each ledger checkpoint as soon as
 * its last expense is visible, then what the engine had learned by that date, and a retirement
 * for anything it had learned before that no longer holds.
 */
export function seedPhases(ledger: Ledger, rateNgnPerUsdc: number, asOfs: readonly string[]): SeedPhase[] {
  const checkpoints = checkpointDrafts(ledger).map((c) => ({ c, last: c.data.expenses.at(-1)!.date }));
  const final = asOfs.at(-1)!;
  const active = new Map<string, Draft>();
  return asOfs.map((asOf, i) => {
    const prev = i === 0 ? "" : asOfs[i - 1]!;
    const due = checkpoints.filter(({ last }) => (asOf === final ? last > prev : last > prev && last <= asOf)).map(({ c }) => c);
    const insights = insightDrafts(ledger, buildFlatView(ledger, asOf));
    const now = new Set(insights.map((d) => `${d.kind}:${d.subject}`));
    const retired = [...active].filter(([key]) => !now.has(key)).map(([, d]) => retiredDraft(d as Draft<"pattern_snapshot">, asOf));
    for (const key of [...active.keys()]) if (!now.has(key)) active.delete(key);
    for (const d of insights) active.set(`${d.kind}:${d.subject}`, d);
    return { asOf, drafts: [...(i === 0 ? [profileDraft(ledger, rateNgnPerUsdc)] : []), ...due, ...insights, ...retired] };
  });
}
