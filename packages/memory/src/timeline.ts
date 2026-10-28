import { isRetired, type Insight } from "./learned.ts";

export interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

export interface TimelineEntry {
  env: Insight;
  status: "new" | "changed" | "retired";
  changes: Change[];
}

export interface TimelineDay {
  asOf: string;
  entries: TimelineEntry[];
}

/** Fields that tell a person what changed; counters that move every snapshot are left to the summary. */
const WATCHED: Record<string, readonly string[]> = {
  R3R6: ["nextPayerId", "usualPayerId", "usualCount", "totalCount"],
  R2: ["nextExpectedDate", "expectedAmountMinor", "cadence"],
  R5: ["label", "medianDelay", "score"],
};

/** Groups the learned history by date and diffs each insight against its previous version. */
export function buildTimeline(history: readonly Insight[]): TimelineDay[] {
  const last = new Map<string, Insight>();
  const days = new Map<string, TimelineEntry[]>();
  for (const env of history) {
    const key = `${env.kind}:${env.subject}`;
    const prev = last.get(key);
    last.set(key, env);
    let entry: TimelineEntry;
    if (isRetired(env)) entry = { env, status: "retired", changes: [] };
    else if (!prev || isRetired(prev)) entry = { env, status: "new", changes: [] };
    else {
      const changes = (WATCHED[env.data.ruleId] ?? [])
        .filter((f) => JSON.stringify(prev.data.output[f]) !== JSON.stringify(env.data.output[f]))
        .map((field) => ({ field, from: prev.data.output[field], to: env.data.output[field] }));
      if (changes.length === 0) continue;
      entry = { env, status: "changed", changes };
    }
    days.set(env.data.asOf, [...(days.get(env.data.asOf) ?? []), entry]);
  }
  return [...days].map(([asOf, entries]) => ({ asOf, entries }));
}
