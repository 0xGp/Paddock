import "server-only";
import { buildFlatView, type Category, type Expense, type Ledger, type Payment } from "@splitsense/engine";
import { cacheLife, cacheTag } from "next/cache";
import { pool } from "@/server/db";
import fixture from "../../../../fixtures/lagos-flat.json";

export const demoGroupId = fixture.group.id;
export const demoAsOf = fixture.now;
export const PAYMENTS_TAG = "payments";

export const demoLedger: Ledger = {
  members: fixture.members.map(({ id, displayName }) => ({ id, displayName })),
  settlements: fixture.settlements,
  expenses: fixture.expenses.map(
    (e): Expense => ({
      ...e,
      amountMinor: BigInt(e.amountMinor),
      currency: "NGN",
      category: e.category as Category,
      split: e.split as Record<string, number>,
    }),
  ),
};

export interface PaymentRow {
  digest: string;
  from: string;
  to: string;
  fromAddress: string;
  toAddress: string;
  microUsdc: bigint;
  amountMinor: bigint;
  checkpoint: number | null;
  settledAt: string;
  confirmMs: number | null;
}

/** Confirmed USDC settlements for a group, newest first. */
export async function getPayments(groupKey: string): Promise<PaymentRow[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 300, expire: 86_400 });
  cacheTag(PAYMENTS_TAG);
  const { rows } = await pool.query(
    `SELECT digest, from_member, to_member, from_address, to_address, micro_usdc, amount_minor, checkpoint, settled_at, confirm_ms
     FROM payments WHERE group_key = $1 ORDER BY settled_at DESC`,
    [groupKey],
  );
  return rows.map((r) => ({
    digest: r.digest,
    from: r.from_member,
    to: r.to_member,
    fromAddress: r.from_address,
    toAddress: r.to_address,
    microUsdc: BigInt(r.micro_usdc),
    amountMinor: BigInt(r.amount_minor),
    checkpoint: r.checkpoint === null ? null : Number(r.checkpoint),
    settledAt: new Date(r.settled_at).toISOString(),
    confirmMs: r.confirm_ms,
  }));
}

/**
 * Ledger math (balances, transfers) comes from the ledger plus confirmed payments; learned rows come
 * from memory. The sample ledger is frozen at `fixture.now`, so later real payments count on that day.
 */
export async function getDemoFlat() {
  const paid = await getPayments(demoGroupId);
  const payments = paid.map((p): Payment => {
    const day = p.settledAt.slice(0, 10);
    return { id: p.digest, from: p.from, to: p.to, amountMinor: p.amountMinor, paidOn: day < fixture.now ? day : fixture.now };
  });
  const view = buildFlatView({ ...demoLedger, payments }, fixture.now);
  const recent = demoLedger.expenses.toSorted((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
  return {
    group: fixture.group,
    synthetic: fixture.synthetic,
    members: demoLedger.members,
    entryCount: demoLedger.expenses.length,
    recent: recent.slice(0, 8),
    payments: paid,
    view,
  };
}

export type DemoFlat = Awaited<ReturnType<typeof getDemoFlat>>;
