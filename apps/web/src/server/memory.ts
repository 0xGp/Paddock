import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import type { Cadence, Category, Explanation } from "@splitsense/engine";
import {
  buildTimeline,
  drain,
  groupNamespace,
  isRetired,
  readSnapshot,
  reconcile,
  reduceLearned,
  refreshSnapshot,
  verifyLedger,
  type Change,
  type Insight,
  type LearnedState,
  type LedgerVerification,
} from "@splitsense/memory";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { env } from "@/env";
import { pool } from "@/server/db";
import { demoGroupId, demoLedger } from "@/server/demo";

export const MEMORY_TAG = "memory";
/** A visit may trigger a background refresh at most this often. */
const REFRESH_EVERY_SEC = 600;

export const demoNamespace = () => groupNamespace(demoGroupId, env.NAMESPACE_SALT);

export interface MemoryRef {
  kind: string;
  subject: string;
  seq: number;
  asOf: string;
  hash: string;
  blobId: string | null;
  createdAt: string | null;
}

export interface LearnedTurn {
  category: Category;
  usualPayerId: string;
  usualCount: number;
  totalCount: number;
  nextPayerId: string;
  explanation: Explanation;
  memory: MemoryRef;
}

export interface LearnedBill {
  category: Category;
  description: string;
  cadence: Cadence;
  nextExpectedDate: string;
  expectedAmountMinor: bigint;
  explanation: Explanation;
  memory: MemoryRef;
}

export interface LearnedHabit {
  memberId: string;
  score: number;
  label: "fast" | "steady" | "slow";
  medianDelay: number;
  explanation: Explanation;
  memory: MemoryRef;
}

export interface LearnedReceipt {
  from: string;
  to: string;
  fromAddress: string;
  toAddress: string;
  amountMinor: bigint;
  microUsdc: bigint;
  digest: string;
  checkpoint: string | null;
  settledAt: string;
  memory: MemoryRef;
}

export interface TimelineItem {
  status: "new" | "changed" | "retired";
  ruleId: string;
  summary: string;
  changes: Change[];
  memory: MemoryRef;
}

export interface DemoMemory {
  state: "live" | "cached" | "missing";
  namespace: string;
  recalledAt: string | null;
  attemptedAt: string | null;
  recallMs: number | null;
  relayerCount: number | null;
  verified: number;
  rejected: number;
  error: string | null;
  learnedAsOf: string | null;
  turns: LearnedTurn[];
  bills: LearnedBill[];
  habits: LearnedHabit[];
  receipts: LearnedReceipt[];
  timeline: { asOf: string; items: TimelineItem[] }[];
  ledger: LedgerVerification | null;
}

const refOf = (state: LearnedState, env: Insight): MemoryRef => ({
  kind: env.kind,
  subject: env.subject,
  seq: env.seq,
  asOf: env.data.asOf,
  hash: env.hash,
  blobId: state.sources[env.hash]?.blobId ?? null,
  createdAt: state.sources[env.hash]?.createdAt ?? null,
});

const explanationOf = (env: Insight): Explanation => ({
  summary: env.data.summary,
  facts: env.data.facts,
  formula: env.data.formula,
  threshold: env.data.threshold,
  evidenceExpenseIds: [],
});

const byAsOfDesc = <T extends { memory: MemoryRef }>(a: T, b: T) => (a.memory.asOf < b.memory.asOf ? 1 : -1);

/**
 * The demo group's learned layer, rebuilt from the texts last recalled from Walrus. Every envelope
 * is re-verified here, so the Postgres copy is a cache of Walrus, never a source of truth.
 */
export async function getDemoMemory(): Promise<DemoMemory> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 86_400 });
  cacheTag(MEMORY_TAG);

  const ns = demoNamespace();
  const snap = await readSnapshot(pool, ns);
  if (!snap) {
    return { state: "missing", namespace: ns, recalledAt: null, attemptedAt: null, recallMs: null, relayerCount: null, verified: 0, rejected: 0, error: null, learnedAsOf: null, turns: [], bills: [], habits: [], receipts: [], timeline: [], ledger: null };
  }

  const learned = reduceLearned(ns, snap.recalled, snap.degraded);
  const live = [...Object.values(learned.patterns), ...Object.values(learned.habits)].filter((e) => !isRetired(e));
  const turns = Object.values(learned.patterns)
    .filter((e) => e.subject.startsWith("turn.") && !isRetired(e))
    .map((e): LearnedTurn => {
      const o = e.data.output as { category: Category; usualPayerId: string; usualCount: number; totalCount: number; nextPayerId: string };
      return { ...o, explanation: explanationOf(e), memory: refOf(learned, e) };
    })
    .sort(byAsOfDesc);
  const bills = Object.values(learned.patterns)
    .filter((e) => e.subject.startsWith("bill.") && !isRetired(e))
    .map((e): LearnedBill => {
      const o = e.data.output as { category: Category; description: string; cadence: Cadence; nextExpectedDate: string; expectedAmountMinor: string };
      return { ...o, expectedAmountMinor: BigInt(o.expectedAmountMinor), explanation: explanationOf(e), memory: refOf(learned, e) };
    })
    .sort((a, b) => (a.nextExpectedDate === b.nextExpectedDate ? (a.category < b.category ? -1 : 1) : a.nextExpectedDate < b.nextExpectedDate ? -1 : 1));
  const habits = Object.values(learned.habits)
    .filter((e) => !isRetired(e))
    .map((e): LearnedHabit => {
      const o = e.data.output as { score: number; label: LearnedHabit["label"]; medianDelay: number };
      return { memberId: e.subject, ...o, explanation: explanationOf(e), memory: refOf(learned, e) };
    })
    .sort((a, b) => b.score - a.score);
  const receipts = Object.values(learned.receipts)
    .map(
      (e): LearnedReceipt => ({
        from: e.data.from,
        to: e.data.to,
        fromAddress: e.data.fromAddress,
        toAddress: e.data.toAddress,
        amountMinor: BigInt(e.data.amountMinor),
        microUsdc: BigInt(e.data.microUsdc),
        digest: e.data.digest,
        checkpoint: e.data.checkpoint ?? null,
        settledAt: e.data.settledAt,
        memory: { kind: e.kind, subject: e.subject, seq: e.seq, asOf: e.data.settledAt.slice(0, 10), hash: e.hash, blobId: learned.sources[e.hash]?.blobId ?? null, createdAt: learned.sources[e.hash]?.createdAt ?? null },
      }),
    )
    .sort((a, b) => (a.settledAt < b.settledAt ? 1 : -1));
  const timeline = buildTimeline(learned.history).map((day) => ({
    asOf: day.asOf,
    items: day.entries.map((t): TimelineItem => ({ status: t.status, ruleId: t.env.data.ruleId, summary: t.env.data.summary, changes: t.changes, memory: refOf(learned, t.env) })),
  }));

  return {
    state: snap.error ? "cached" : "live",
    namespace: ns,
    recalledAt: snap.recalledAt,
    attemptedAt: snap.attemptedAt,
    recallMs: snap.recallMs,
    relayerCount: snap.relayerCount,
    verified: learned.verified,
    rejected: learned.rejected,
    error: snap.error,
    learnedAsOf: live.reduce<string | null>((max, e) => (!max || e.data.asOf > max ? e.data.asOf : max), null),
    turns,
    bills,
    habits,
    receipts,
    timeline,
    ledger: verifyLedger(ns, snap.recalled, demoLedger),
  };
}

const memwal = () => MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL, requestTimeoutMs: 45_000 });

/** Claims the refresh slot so concurrent visitors trigger at most one recall per interval. */
async function claimRefresh(ns: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE memory_snapshots SET attempted_at = now() WHERE namespace = $1 AND attempted_at < now() - make_interval(secs => $2)`,
    [ns, REFRESH_EVERY_SEC],
  );
  if (rowCount) return true;
  const { rows } = await pool.query(`SELECT 1 FROM memory_snapshots WHERE namespace = $1`, [ns]);
  return rows.length === 0;
}

/** Recall from Walrus into the snapshot, then let cached pages pick it up. */
export async function refreshDemoMemory({ force = false } = {}) {
  const ns = demoNamespace();
  if (!force && !(await claimRefresh(ns))) return { ok: true, skipped: true };
  const client = memwal();
  try {
    const result = await refreshSnapshot(pool, client, ns);
    revalidateTag(MEMORY_TAG, "max");
    return { ...result, skipped: false };
  } finally {
    client.destroy();
  }
}

/** After a settlement: send its receipt, wait for the blob, then re-read memory so pages show it. */
export async function publishReceipts({ polls = 12, pollMs = 3_000 } = {}) {
  const client = memwal();
  try {
    await drain(pool, client);
    for (let i = 0; i < polls; i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      const r = await reconcile(pool, client);
      if (r.pending === 0) break;
    }
  } finally {
    client.destroy();
  }
  return refreshDemoMemory({ force: true });
}

/** One paced outbox step: send what the budget allows, record blob ids for finished jobs. */
export async function pumpOutbox() {
  const client = memwal();
  try {
    const sent = await drain(pool, client);
    const stored = await reconcile(pool, client);
    return { sent, stored };
  } finally {
    client.destroy();
  }
}
