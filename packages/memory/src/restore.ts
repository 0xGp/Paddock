import { ledgerHash, type Ledger } from "@splitsense/engine";
import { open, type Envelope } from "./envelope.ts";
import type { Recalled } from "./learned.ts";

export interface LedgerVerification {
  checkpoints: number;
  /** Entries whose Walrus checkpoint hash matches both the restored chunks and the local ledger. */
  verifiedEntries: number;
  totalEntries: number;
  ok: boolean;
  reason?: string;
}

const byDateId = (a: { date: string; id: string }, b: { date: string; id: string }) =>
  a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1;

/**
 * Rebuilds the ledger from Walrus checkpoints in order and checks each cumulative hash twice:
 * against the restored entries (Walrus is self-consistent) and against the local ledger
 * (Postgres matches what was remembered). Stops at the first gap or mismatch.
 */
export function verifyLedger(ns: string, recalled: readonly Recalled[], ledger: Pick<Ledger, "expenses" | "settlements">): LedgerVerification {
  const chunks = new Map<string, Envelope<"ledger_checkpoint">>();
  for (const r of recalled) {
    const res = open(r.text, ns);
    if (!res.ok || res.envelope.kind !== "ledger_checkpoint") continue;
    const env = res.envelope as Envelope<"ledger_checkpoint">;
    const cur = chunks.get(env.subject);
    if (!cur || env.seq > cur.seq) chunks.set(env.subject, env);
  }
  const ordered = [...chunks.values()].sort((a, b) => (a.subject < b.subject ? -1 : 1));
  const local = ledger.expenses.toSorted(byDateId);
  const totalEntries = local.length;
  const result = (verifiedEntries: number, reason?: string): LedgerVerification => ({
    checkpoints: ordered.length,
    verifiedEntries,
    totalEntries,
    ok: !reason && verifiedEntries === totalEntries,
    ...(reason ? { reason } : verifiedEntries < totalEntries ? { reason: `entries after ${verifiedEntries} not checkpointed yet` } : {}),
  });

  const restoredExpenses: unknown[] = [];
  const restoredSettlements: unknown[] = [];
  let verified = 0;
  for (const [i, cp] of ordered.entries()) {
    if (cp.subject !== `ledger.${String(i).padStart(3, "0")}`) return result(verified, `checkpoint ${i} missing`);
    restoredExpenses.push(...cp.data.expenses);
    restoredSettlements.push(...cp.data.settlements);
    if (restoredExpenses.length !== cp.data.entryCount) return result(verified, `checkpoint ${i} entry count mismatch`);
    const restored = ledgerHash({ expenses: restoredExpenses as Ledger["expenses"], settlements: restoredSettlements as Ledger["settlements"] });
    if (restored !== cp.data.ledgerHash) return result(verified, `checkpoint ${i} does not match its own hash`);
    const prefix = local.slice(0, cp.data.entryCount);
    const ids = new Set(prefix.map((e) => e.id));
    const mine = ledgerHash({ expenses: prefix, settlements: ledger.settlements.filter((s) => ids.has(s.expenseId)) });
    if (mine !== cp.data.ledgerHash) return result(verified, `local ledger differs from Walrus in entries ${verified + 1}–${cp.data.entryCount}`);
    verified = cp.data.entryCount;
  }
  return result(verified);
}
