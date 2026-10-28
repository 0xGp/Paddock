import { canonicalJSON, hashOf } from "@splitsense/engine";
import { z } from "zod";

export const MEMORY_KINDS = ["group_profile", "ledger_checkpoint", "pattern_snapshot", "member_habit", "preference", "settlement_receipt"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

const fact = z.object({ label: z.string(), value: z.string() });
const insight = z.object({
  ruleId: z.string(),
  asOf: z.iso.date(),
  summary: z.string(),
  output: z.record(z.string(), z.unknown()),
  facts: z.array(fact),
  formula: z.string(),
  threshold: z.string(),
  ledgerHash: z.string().length(64),
  rulesetVersion: z.string(),
});

const minor = z.string().regex(/^-?\d+$/);
const expense = z.object({
  id: z.string(),
  date: z.string(),
  amountMinor: minor,
  currency: z.literal("NGN"),
  payerId: z.string(),
  category: z.string(),
  description: z.string(),
  split: z.record(z.string(), z.number().int()),
});
const settlement = z.object({ expenseId: z.string(), memberId: z.string(), settledOn: z.string() });

export const KIND_DATA = {
  group_profile: z.object({
    members: z.array(z.object({ id: z.string(), displayName: z.string() })),
    baseCurrency: z.literal("NGN"),
    rateNgnPerUsdc: z.number().int().positive(),
    rulesetVersion: z.string(),
  }),
  ledger_checkpoint: z.object({
    expenses: z.array(expense),
    settlements: z.array(settlement),
    entryCount: z.number().int().nonnegative(),
    ledgerHash: z.string().length(64),
  }),
  pattern_snapshot: insight,
  member_habit: insight,
  preference: z.object({ type: z.enum(["alias", "suggestion_feedback"]), value: z.record(z.string(), z.unknown()) }),
  settlement_receipt: z.object({
    /** Member ids. */
    from: z.string(),
    to: z.string(),
    fromAddress: z.string().regex(/^0x[0-9a-f]{64}$/),
    toAddress: z.string().regex(/^0x[0-9a-f]{64}$/),
    /** The NGN this payment settles, at the group rate. */
    amountMinor: minor,
    microUsdc: minor,
    coinType: z.string(),
    digest: z.string(),
    checkpoint: z.string().optional(),
    settledAt: z.iso.datetime(),
    /** Debt edges fully closed; empty for a payment that only reduces the balance. */
    expenseIds: z.array(z.string()),
    confirmedBy: z.literal("tatum-graphql"),
  }),
} satisfies Record<MemoryKind, z.ZodType>;

export type KindData<K extends MemoryKind> = z.infer<(typeof KIND_DATA)[K]>;

const body = z.object({
  v: z.literal(1),
  kind: z.enum(MEMORY_KINDS),
  ns: z.string(),
  subject: z.string().min(1),
  seq: z.number().int().positive(),
  at: z.iso.datetime(),
  prev: z.string().length(64).nullable(),
  data: z.unknown(),
  hash: z.string().length(64),
});

export interface Envelope<K extends MemoryKind = MemoryKind> {
  v: 1;
  kind: K;
  ns: string;
  subject: string;
  seq: number;
  at: string;
  prev: string | null;
  data: KindData<K>;
  hash: string;
}

export interface Draft<K extends MemoryKind = MemoryKind> {
  kind: K;
  subject: string;
  data: KindData<K>;
}

const HEADER = /^SPLITSENSE v1 \| kind=([a-z_]+) \| group=(\S+) \| subject=(\S+) \| seq=(\d+) \| at=(\S+)$/;

/** Seals a draft into the stored text. `hash` covers every field except itself (ADR-0006). */
export function seal<K extends MemoryKind>(draft: Draft<K>, ns: string, seq: number, prev: string | null, at: string): { envelope: Envelope<K>; text: string } {
  const data = JSON.parse(canonicalJSON(KIND_DATA[draft.kind].parse(draft.data))) as KindData<K>;
  const unsigned = { v: 1 as const, kind: draft.kind, ns, subject: draft.subject, seq, at, prev, data };
  const envelope = { ...unsigned, hash: hashOf(unsigned) };
  const header = `SPLITSENSE v1 | kind=${draft.kind} | group=${ns} | subject=${draft.subject} | seq=${seq} | at=${at}`;
  return { envelope, text: `${header}\n${canonicalJSON(envelope)}` };
}

export type OpenResult = { ok: true; envelope: Envelope } | { ok: false; reason: string };

/** Parses and verifies recalled text. Anything foreign, malformed or tampered is rejected. */
export function open(text: string, expectedNs?: string): OpenResult {
  const nl = text.indexOf("\n");
  if (nl < 0) return { ok: false, reason: "no header" };
  const header = HEADER.exec(text.slice(0, nl));
  if (!header) return { ok: false, reason: "foreign header" };
  let json: unknown;
  try {
    json = JSON.parse(text.slice(nl + 1));
  } catch {
    return { ok: false, reason: "bad json" };
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "bad envelope" };
  const { hash, ...unsigned } = parsed.data;
  if (hashOf(unsigned) !== hash) return { ok: false, reason: "hash mismatch" };
  const [, kind, ns, subject, seq, at] = header;
  if (kind !== unsigned.kind || ns !== unsigned.ns || subject !== unsigned.subject || Number(seq) !== unsigned.seq || at !== unsigned.at) {
    return { ok: false, reason: "header mismatch" };
  }
  if (expectedNs && unsigned.ns !== expectedNs) return { ok: false, reason: "wrong namespace" };
  const data = KIND_DATA[unsigned.kind].safeParse(unsigned.data);
  if (!data.success) return { ok: false, reason: `bad ${unsigned.kind} data` };
  return { ok: true, envelope: { ...unsigned, data: data.data, hash } as Envelope };
}

export type Heads = Map<MemoryKind, { seq: number; hash: string }>;

/** Assigns `seq` and `prev` per (namespace, kind) and returns the sealed texts plus the new heads. */
export function sealAll(drafts: readonly Draft[], ns: string, heads: Heads, at: string) {
  const next: Heads = new Map(heads);
  const sealed = drafts.map((d) => {
    const head = next.get(d.kind);
    const out = seal(d, ns, (head?.seq ?? 0) + 1, head?.hash ?? null, at);
    next.set(d.kind, { seq: out.envelope.seq, hash: out.envelope.hash });
    return out;
  });
  return { sealed, heads: next };
}
