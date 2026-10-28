import { describe, expect, it } from "vitest";
import { ledger } from "../../engine/test/fixture.ts";
import { buildTimeline, checkpointDrafts, groupNamespace, reduceLearned, sealAll, seedPhases, verifyLedger, type Draft } from "../src/index.ts";

const ns = groupNamespace("flat-3b", "test-salt-0123456789");
const AT = "2026-10-28T09:00:00.000Z";
const recalledOf = (drafts: readonly Draft[]) => sealAll(drafts, ns, new Map(), AT).sealed.map((s) => ({ text: s.text, blob_id: `b${s.envelope.seq}` }));

describe("verifyLedger", () => {
  const cps = recalledOf(checkpointDrafts(ledger));

  it("verifies the whole ledger from Walrus checkpoints, in any recall order", () => {
    expect(verifyLedger(ns, cps.toReversed(), ledger)).toEqual({ checkpoints: 4, verifiedEntries: ledger.expenses.length, totalEntries: ledger.expenses.length, ok: true });
  });

  it("stops at the first gap", () => {
    const v = verifyLedger(ns, cps.filter((_, i) => i !== 1), ledger);
    expect(v).toMatchObject({ verifiedEntries: 10, ok: false, reason: "checkpoint 1 missing" });
  });

  it("reports where the local ledger stops matching Walrus", () => {
    const sorted = ledger.expenses.toSorted((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
    const target = sorted[14]!.id;
    const edited = { ...ledger, expenses: ledger.expenses.map((e) => (e.id === target ? { ...e, amountMinor: e.amountMinor + 100n } : e)) };
    expect(verifyLedger(ns, cps, edited)).toMatchObject({ verifiedEntries: 10, ok: false, reason: "local ledger differs from Walrus in entries 11–20" });
  });

  it("reports new entries that are not checkpointed yet", () => {
    const extra = { ...ledger.expenses[0]!, id: "zz-new", date: "2026-10-30" };
    expect(verifyLedger(ns, cps, { ...ledger, expenses: [...ledger.expenses, extra] })).toMatchObject({ verifiedEntries: 37, totalEntries: 38, ok: false });
  });
});

describe("timeline", () => {
  const phases = seedPhases(ledger, 1500, ["2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15", "2026-11-01"]);
  let heads = new Map();
  const recalled = phases.flatMap((p) => {
    const out = sealAll(p.drafts, ns, heads, AT);
    heads = out.heads;
    return out.sealed.map((s) => ({ text: s.text, blob_id: "x" }));
  });
  const state = reduceLearned(ns, recalled);
  const days = buildTimeline(state.history);

  it("retires what stopped holding and the reader sees it as retired", () => {
    const retired = phases.at(-1)!.drafts.filter((d) => (d.data as { output?: { retired?: boolean } }).output?.retired);
    expect(retired.map((d) => d.subject)).toEqual(["turn.groceries"]);
    expect(state.patterns["turn.groceries"]!.data.output.retired).toBe(true);
  });

  it("starts with first sightings and records what changed, with before and after", () => {
    expect(days[0]!.asOf).toBe("2026-09-01");
    expect(days[0]!.entries.every((e) => e.status === "new")).toBe(true);
    const fuel = days.flatMap((d) => d.entries).filter((e) => e.env.subject === "turn.fuel" && e.status === "changed");
    expect(fuel[0]!.changes).toContainEqual({ field: "nextPayerId", from: "ada", to: "emeka" });
    expect(days.at(-1)!.entries.find((e) => e.env.subject === "turn.groceries")!.status).toBe("retired");
  });
});
