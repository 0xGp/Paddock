import { learnedHash } from "@splitsense/engine";
import type { Recaller } from "./client.ts";
import { open, type Envelope, type MemoryKind } from "./envelope.ts";

export type Insight = Envelope<"pattern_snapshot" | "member_habit">;

export interface MemorySource {
  blobId: string;
  createdAt: string | null;
}

export interface LearnedState {
  ns: string;
  /** Latest envelope per subject: latest `asOf`, then highest `seq`. Retired subjects included. */
  patterns: Record<string, Envelope<"pattern_snapshot">>;
  habits: Record<string, Envelope<"member_habit">>;
  preferences: Record<string, Envelope<"preference">>;
  /** Confirmed on-chain settlements by transaction digest. */
  receipts: Record<string, Envelope<"settlement_receipt">>;
  /** One verified insight per (kind, subject, asOf), in the order it was learned: the "how it learned" timeline. */
  history: Insight[];
  /** Walrus blob and write time per envelope hash, for linking evidence. */
  sources: Record<string, MemorySource>;
  /** Distinct verified envelopes of any kind. */
  verified: number;
  rejected: number;
  degraded: boolean;
  hash: string;
}

export interface Recalled {
  text: string;
  blob_id: string;
  created_at?: string | null;
}

export const isRetired = (env: Insight) => env.data.output.retired === true;

const asOfOf = (env: Envelope) => (env.data as { asOf?: string }).asOf ?? "";

/** Newer knowledge wins: the later `asOf`, then the higher `seq`. */
const isNewer = (a: Envelope, b: Envelope) => (asOfOf(a) !== asOfOf(b) ? asOfOf(a) > asOfOf(b) : a.seq > b.seq);

function latest<K extends MemoryKind>(into: Record<string, Envelope<K>>, env: Envelope<K>) {
  const cur = into[env.subject];
  if (!cur || isNewer(env, cur)) into[env.subject] = env;
}

/** Pure reducer over recalled texts; foreign, tampered or cross-namespace texts are counted and dropped. */
export function reduceLearned(ns: string, recalled: readonly Recalled[], degraded = false): LearnedState {
  const state: LearnedState = { ns, patterns: {}, habits: {}, preferences: {}, receipts: {}, history: [], sources: {}, verified: 0, rejected: 0, degraded, hash: "" };
  const timeline = new Map<string, Insight>();
  for (const r of recalled) {
    const res = open(r.text, ns);
    if (!res.ok) {
      state.rejected++;
      continue;
    }
    const env = res.envelope;
    if (state.sources[env.hash]) continue;
    state.sources[env.hash] = { blobId: r.blob_id, createdAt: r.created_at ?? null };
    state.verified++;
    if (env.kind === "pattern_snapshot") latest(state.patterns, env as Envelope<"pattern_snapshot">);
    else if (env.kind === "member_habit") latest(state.habits, env as Envelope<"member_habit">);
    else if (env.kind === "preference") latest(state.preferences, env as Envelope<"preference">);
    else if (env.kind === "settlement_receipt") latest(state.receipts, env as Envelope<"settlement_receipt">);
    if (env.kind === "pattern_snapshot" || env.kind === "member_habit") {
      const key = `${env.kind}:${env.subject}:${asOfOf(env)}`;
      const twin = timeline.get(key);
      if (!twin || env.seq < twin.seq) timeline.set(key, env as Insight);
    }
  }
  state.history = [...timeline.values()];
  state.history.sort((a, b) =>
    a.data.asOf !== b.data.asOf ? (a.data.asOf < b.data.asOf ? -1 : 1) : a.kind !== b.kind ? (a.kind < b.kind ? -1 : 1) : a.seq - b.seq,
  );
  const heads = (m: Record<string, Envelope>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.hash]));
  state.hash = learnedHash({ patterns: heads(state.patterns), habits: heads(state.habits), preferences: heads(state.preferences) });
  return state;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`recall timed out after ${ms}ms`)), ms);
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

export const LEARNED_KINDS = ["pattern_snapshot", "member_habit", "preference"] as const satisfies readonly MemoryKind[];

/**
 * Relevance queries shaped like each kind's text. `sort: "recent"` is not usable here: the relayer
 * then ignores the query and returns the newest N memories of any kind.
 */
const KIND_QUERY: Record<MemoryKind, string> = {
  pattern_snapshot: "has covered times next comes monthly weekly usually R2 R3R6 nextPayerId nextExpectedDate",
  member_habit: "usually settles in about days fast steady slow R5 score label medianDelay",
  preference: "preference alias suggestion_feedback",
  ledger_checkpoint: "subject=ledger expenses settlements entryCount ledgerHash",
  group_profile: "subject=group members baseCurrency rateNgnPerUsdc",
  settlement_receipt: "settlement receipt digest microUsdc fromAddress toAddress settledAt tatum-graphql",
};

export const kindQuery = (kind: MemoryKind, ns: string) => `SPLITSENSE v1 | kind=${kind} | group=${ns} ${KIND_QUERY[kind]}`;

/**
 * One recall per kind (≤ 4, ADR-0005) under a per-recall time budget. Never throws. `sequential`
 * keeps the relayer's SEAL decrypt step under its own ~13 s limit when limits are large.
 */
export async function recallNamespace(
  client: Recaller,
  ns: string,
  opts: { kinds?: readonly MemoryKind[]; timeoutMs?: number; limit?: number | Partial<Record<MemoryKind, number>>; sequential?: boolean } = {},
): Promise<{ recalled: Recalled[]; degraded: boolean; ms: number; errors: string[] }> {
  const { kinds = LEARNED_KINDS, timeoutMs = 1500, limit = 50, sequential = false } = opts;
  if (kinds.length > 4) throw new Error("at most 4 recalls per load (ADR-0005)");
  const started = Date.now();
  const limitOf = (kind: MemoryKind) => (typeof limit === "number" ? limit : (limit[kind] ?? 50));
  const one = (kind: MemoryKind) => withTimeout(client.recall({ query: kindQuery(kind, ns), namespace: ns, limit: limitOf(kind) }), timeoutMs);
  let settled: PromiseSettledResult<Awaited<ReturnType<Recaller["recall"]>>>[];
  if (sequential) {
    settled = [];
    for (const kind of kinds) settled.push(...(await Promise.allSettled([one(kind)])));
  } else {
    settled = await Promise.allSettled(kinds.map(one));
  }
  const byBlob = new Map<string, Recalled>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const { text, blob_id, created_at } of s.value.results) if (!byBlob.has(blob_id)) byBlob.set(blob_id, { text, blob_id, created_at: created_at ?? null });
  }
  const recalled = [...byBlob.values()];
  const errors = settled.flatMap((s) => (s.status === "rejected" ? [String((s.reason as Error)?.message ?? s.reason)] : []));
  const degraded = errors.length > 0 || settled.some((s) => s.status === "fulfilled" && (s.value.dropped_count ?? 0) > 0);
  return { recalled, degraded, ms: Date.now() - started, errors };
}

/** Recalls and reduces the learned layer for one group. A failed or slow recall degrades instead of throwing. */
export async function loadLearnedState(client: Recaller, ns: string, opts: { timeoutMs?: number; limit?: number } = {}): Promise<LearnedState> {
  const { recalled, degraded } = await recallNamespace(client, ns, opts);
  return reduceLearned(ns, recalled, degraded);
}
