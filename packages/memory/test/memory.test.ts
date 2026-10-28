import { MemWalMock } from "@mysten-incubation/memwal";
import { buildFlatView, ledgerHash } from "@splitsense/engine";
import { describe, expect, it } from "vitest";
import { asOf, ledger } from "../../engine/test/fixture.ts";
import {
  checkpointDrafts,
  groupNamespace,
  insightDrafts,
  isNewKnowledge,
  loadLearnedState,
  materialHash,
  open,
  profileDraft,
  reduceLearned,
  seal,
  sealAll,
  seedPhases,
  type Heads,
  type Recaller,
} from "../src/index.ts";

const SALT = "test-salt-0123456789";
const ns = groupNamespace("lagos-flat", SALT);
const AT = "2026-10-28T09:00:00.000Z";

describe("namespace", () => {
  it("is opaque and stable", () => {
    expect(ns).toMatch(/^ss_g_[0-9a-f]{16}$/);
    expect(ns).toBe(groupNamespace("lagos-flat", SALT));
    expect(ns).not.toBe(groupNamespace("lagos-flat", `${SALT}x`));
  });
});

describe("envelope", () => {
  const draft = profileDraft(ledger, 1600);

  it("round-trips and verifies", () => {
    const { text, envelope } = seal(draft, ns, 1, null, AT);
    expect(text.split("\n")[0]).toBe(`SPLITSENSE v1 | kind=group_profile | group=${ns} | subject=group | seq=1 | at=${AT}`);
    const res = open(text, ns);
    expect(res.ok && res.envelope.hash).toBe(envelope.hash);
  });

  it("rejects a tampered body", () => {
    const { text } = seal(draft, ns, 1, null, AT);
    expect(open(text.replace('"rateNgnPerUsdc":1600', '"rateNgnPerUsdc":1700'), ns)).toEqual({ ok: false, reason: "hash mismatch" });
  });

  it("rejects a header that disagrees with the body", () => {
    const { text } = seal(draft, ns, 1, null, AT);
    expect(open(text.replace("seq=1 |", "seq=9 |"), ns)).toEqual({ ok: false, reason: "header mismatch" });
  });

  it("rejects foreign text and other namespaces", () => {
    expect(open("I'm allergic to peanuts", ns).ok).toBe(false);
    expect(open(seal(draft, ns, 1, null, AT).text, "ss_g_0000000000000000")).toEqual({ ok: false, reason: "wrong namespace" });
  });

  it("chains seq and prev per kind", () => {
    const drafts = [...insightDrafts(ledger, buildFlatView(ledger, asOf)), profileDraft(ledger, 1600)];
    const { sealed, heads } = sealAll(drafts, ns, new Map(), AT);
    const patterns = sealed.map((s) => s.envelope).filter((e) => e.kind === "pattern_snapshot");
    expect(patterns.map((e) => e.seq)).toEqual(patterns.map((_, i) => i + 1));
    expect(patterns[0]!.prev).toBeNull();
    for (let i = 1; i < patterns.length; i++) expect(patterns[i]!.prev).toBe(patterns[i - 1]!.hash);
    expect(heads.get("group_profile")).toEqual({ seq: 1, hash: sealed.at(-1)!.envelope.hash });
  });
});

describe("derive", () => {
  const view = buildFlatView(ledger, asOf);

  it("writes one memory per learned subject", () => {
    const subjects = insightDrafts(ledger, view).map((d) => `${d.kind}:${d.subject}`);
    expect(subjects).toContain("pattern_snapshot:turn.fuel");
    expect(subjects).toContain("member_habit:emeka");
    expect(subjects.length).toBe(view.turns.length + view.upcoming.length + view.reliability.length);
  });

  it("checkpoints cover the whole ledger and end on its hash", () => {
    const cps = checkpointDrafts(ledger);
    expect(cps.reduce((n, c) => n + c.data.expenses.length, 0)).toBe(ledger.expenses.length);
    expect(cps.at(-1)!.data.ledgerHash).toBe(ledgerHash(ledger));
    for (const c of cps) expect(seal(c, ns, 1, null, AT).text.length).toBeLessThan(8_000);
  });
});

describe("isNewKnowledge", () => {
  const [sep] = insightDrafts(ledger, buildFlatView(ledger, "2026-09-15"));
  const oct = insightDrafts(ledger, buildFlatView(ledger, asOf)).find((d) => d.subject === sep!.subject)!;
  const row = (d: typeof oct) => ({ materialHash: materialHash(d), asOf: (d.data as { asOf: string }).asOf });

  it("writes first sightings and later changes", () => {
    expect(isNewKnowledge(sep!, undefined)).toBe(true);
    expect(isNewKnowledge(oct, row(sep!))).toBe(true);
  });

  it("never writes the same material or older knowledge again", () => {
    expect(isNewKnowledge(oct, row(oct))).toBe(false);
    expect(isNewKnowledge(sep!, row(oct))).toBe(false);
  });

  it("dedupes undated memories by material only", () => {
    const [cp] = checkpointDrafts(ledger);
    expect(isNewKnowledge(cp!, { materialHash: materialHash(cp!), asOf: null })).toBe(false);
  });
});

describe("seed phases", () => {
  it("start with the profile and place every checkpoint exactly once, after its last expense", () => {
    const asOfs = ["2026-09-01", "2026-10-01", "2026-11-01"];
    const phases = seedPhases(ledger, 1500, asOfs);
    expect(phases[0]!.drafts[0]!.kind).toBe("group_profile");
    const cps = phases.flatMap((p) => p.drafts.filter((d) => d.kind === "ledger_checkpoint").map((d) => ({ asOf: p.asOf, d })));
    expect(cps.map(({ d }) => d.subject)).toEqual(checkpointDrafts(ledger).map((d) => d.subject));
    for (const { asOf, d } of cps.slice(0, -1)) {
      expect((d.data as { expenses: { date: string }[] }).expenses.at(-1)!.date <= asOf).toBe(true);
    }
  });
});

describe("learned state", () => {
  const earlier = insightDrafts(ledger, buildFlatView(ledger, "2026-09-15"));
  const later = insightDrafts(ledger, buildFlatView(ledger, asOf));
  const first = sealAll(earlier, ns, new Map(), "2026-09-15T09:00:00.000Z");
  const second = sealAll(later, ns, first.heads as Heads, AT);
  const texts = [...first.sealed, ...second.sealed].map((s) => s.text);

  it("keeps the latest seq per subject and the full history", () => {
    const state = reduceLearned(ns, texts.toReversed().map((text, i) => ({ text, blob_id: `b${i}` })));
    expect(state.patterns["turn.fuel"]!.data.asOf).toBe(asOf);
    expect(state.habits["emeka"]!.data.asOf).toBe(asOf);
    expect(state.history.length).toBe(texts.length);
    expect(state.history[0]!.data.asOf).toBe("2026-09-15");
    expect(state.rejected).toBe(0);
  });

  it("is order independent and counts junk as rejected", () => {
    const a = reduceLearned(ns, texts.map((text) => ({ text, blob_id: "x" })));
    const b = reduceLearned(ns, [...texts.toReversed(), "noise"].map((text) => ({ text, blob_id: "x" })));
    expect(b.hash).toBe(a.hash);
    expect(b.rejected).toBe(1);
  });

  it("survives a history replay: newest asOf wins and the timeline has no twins", () => {
    const replay = sealAll(earlier, ns, second.heads, "2026-10-28T16:09:00.000Z");
    const all = [...texts, ...replay.sealed.map((s) => s.text)].map((text) => ({ text, blob_id: "x" }));
    const clean = reduceLearned(ns, texts.map((text) => ({ text, blob_id: "x" })));
    const replayed = reduceLearned(ns, all);
    expect(replayed.patterns["turn.fuel"]!.data.asOf).toBe(asOf);
    expect(replayed.history.length).toBe(clean.history.length);
    expect(replayed.hash).toBe(clean.hash);
  });

  it("loads from MemWal within the recall budget", async () => {
    const mock = MemWalMock.create({ namespace: ns, initialMemories: [...texts.map((text) => ({ text, namespace: ns })), { text: "unrelated", namespace: ns }] });
    let calls = 0;
    const client: Recaller = { recall: (p) => (calls++, mock.recall(p)) };
    const state = await loadLearnedState(client, ns, { limit: 100 });
    expect(calls).toBeLessThanOrEqual(4);
    expect(Object.keys(state.patterns).sort()).toEqual(Object.keys(reduceLearned(ns, texts.map((text) => ({ text, blob_id: "" }))).patterns).sort());
    expect(state.degraded).toBe(false);
  });

  it("degrades instead of throwing when recall fails or stalls", async () => {
    const state = await loadLearnedState({ recall: () => new Promise(() => {}) }, ns, { timeoutMs: 20 });
    expect(state.degraded).toBe(true);
    expect(Object.keys(state.patterns)).toEqual([]);
  });
});
