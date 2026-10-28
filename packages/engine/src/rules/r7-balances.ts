import { allocate } from "../money.ts";
import type { Expense, MemberId } from "../types.ts";

export interface Transfer {
  from: MemberId;
  to: MemberId;
  amountMinor: bigint;
}

export function netBalances(expenses: readonly Expense[]): Map<MemberId, bigint> {
  const net = new Map<MemberId, bigint>();
  const add = (id: MemberId, v: bigint) => net.set(id, (net.get(id) ?? 0n) + v);
  for (const e of expenses) {
    add(e.payerId, e.amountMinor);
    for (const [id, owed] of allocate(e.amountMinor, e.split)) add(id, -owed);
  }
  return net;
}

const byAmountDescThenId = (a: [MemberId, bigint], b: [MemberId, bigint]) =>
  a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] > b[1] ? -1 : 1;

/** R7: greedy pairing of largest debtor with largest creditor. At most members − 1 transfers. */
export function minimalTransfers(net: ReadonlyMap<MemberId, bigint>): Transfer[] {
  const debtors = [...net].filter(([, v]) => v < 0n).map(([id, v]): [MemberId, bigint] => [id, -v]);
  const creditors = [...net].filter(([, v]) => v > 0n).map(([id, v]): [MemberId, bigint] => [id, v]);
  debtors.sort(byAmountDescThenId);
  creditors.sort(byAmountDescThenId);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = d[1] < c[1] ? d[1] : c[1];
    transfers.push({ from: d[0], to: c[0], amountMinor: amount });
    d[1] -= amount;
    c[1] -= amount;
    if (d[1] === 0n) i++;
    if (c[1] === 0n) j++;
  }
  return transfers;
}
