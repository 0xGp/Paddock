import "server-only";
import { confirmTransfer, formatUsdc, getBalance, MIN_SETTLEMENT_MICRO, normalizeAddress, SUI_COIN_TYPE, transferTx, type ExpectedTransfer } from "@splitsense/chain";
import { enqueue, groupNamespace, receiptDraft } from "@splitsense/memory";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { revalidateTag } from "next/cache";
import { env } from "@/env";
import { pool } from "@/server/db";
import { PAYMENTS_TAG } from "@/server/demo";
import { balancesFor, groupAs, memberships, memoryOn, type Group } from "@/server/groups";
import { AppError } from "@/server/http";
import { demoNamespace } from "@/server/memory";
import { suiClient, tatum } from "@/server/tatum";

export class SettleError extends AppError {}

export async function walletBalances(address: string) {
  const started = Date.now();
  const [usdc, sui] = await Promise.all([getBalance(tatum(), address, env.USDC_COIN_TYPE), getBalance(tatum(), address, SUI_COIN_TYPE)]);
  if (!usdc.ok || !sui.ok) {
    const error = !usdc.ok ? usdc.error : !sui.ok ? sui.error : null;
    return { ok: false as const, error: `${error?.kind}: ${error?.message}`, ms: Date.now() - started };
  }
  return { ok: true as const, usdcMicro: usdc.value, suiMist: sui.value, ms: Date.now() - started, plan: usdc.plan };
}

const namespaceOf = (group: Group) => (group.demo ? demoNamespace() : groupNamespace(group.id, env.NAMESPACE_SALT));

/** Confirmed payments across every group the wallet is in, each with its receipt's progress onto Walrus. */
export async function activity(address: string) {
  const loaded = await memberships(address);
  const all = loaded.flatMap(({ group, me }) => {
    const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? id;
    return group.payments.map((p) => ({ ...p, groupId: group.id, groupName: group.name, me: me.id, fromName: name(p.from), toName: name(p.to), memory: memoryOn(group) }));
  });
  const digests = all.map((p) => p.digest);
  const { rows } = digests.length
    ? await pool.query(`SELECT subject, status, blob_id FROM memory_outbox WHERE kind = 'settlement_receipt' AND subject = ANY($1)`, [digests])
    : { rows: [] };
  const receipts = new Map(rows.map((r) => [r.subject as string, { status: r.status as string, blobId: (r.blob_id as string | null) ?? null }]));
  return {
    groups: loaded.map(({ group }) => ({ id: group.id, name: group.name, kind: group.kind })),
    payments: all.toSorted((a, b) => (a.settledAt < b.settledAt ? 1 : -1)).map((p) => ({ ...p, receipt: p.memory ? (receipts.get(p.digest) ?? null) : undefined })),
  };
}

/** Checks a settlement against the payer's current debts in the group and returns the transfer it must make. */
async function expectedTransfer(address: string, groupId: string, to: string, microUsdc: bigint) {
  const { group, me } = await groupAs(groupId, address);
  const debt = balancesFor(group, me.id).owe.find((o) => o.memberId === to);
  if (!debt) throw new SettleError(`you don't owe ${group.members.find((m) => m.id === to)?.name ?? "them"} anything right now`, 409);
  if (!debt.address) throw new SettleError(`${debt.name} hasn't linked a wallet yet`, 409);
  if (microUsdc < MIN_SETTLEMENT_MICRO) throw new SettleError("the minimum is 0.01 USDC");
  if (microUsdc > debt.microUsdc) throw new SettleError(`that's more than the ${formatUsdc(debt.microUsdc)} USDC you owe ${debt.name}`);
  const expected: ExpectedTransfer = { from: normalizeAddress(address), to: debt.address, amount: microUsdc, coinType: env.USDC_COIN_TYPE };
  return { group, me, expected };
}

/** Builds the gasless transfer through Tatum for the wallet to sign. */
export async function prepareSettlement(address: string, groupId: string, to: string, microUsdc: bigint) {
  const { expected } = await expectedTransfer(address, groupId, to, microUsdc);
  const bytes = await transferTx(expected).build({ client: suiClient() });
  return { bytes: toBase64(bytes), expected };
}

/**
 * Executes a wallet-signed settlement through Tatum, confirms it, records the payment and queues its
 * Walrus receipt when the group's memory is on. Only transactions that move exactly the expected USDC
 * are submitted.
 */
export async function executeSettlement(input: { address: string; group: string; to: string; microUsdc: bigint; bytes: string; signature: string }) {
  const { group, me, expected } = await expectedTransfer(input.address, input.group, input.to, input.microUsdc);
  const bytes = fromBase64(input.bytes);
  const sender = Transaction.from(bytes).getData().sender;
  if (!sender || normalizeAddress(sender) !== expected.from) throw new SettleError("the transaction isn't from this wallet", 403);
  try {
    await verifyTransactionSignature(bytes, input.signature, { address: expected.from, client: suiClient() });
  } catch {
    throw new SettleError("the wallet signature doesn't match this transaction", 403);
  }

  const sim = await suiClient().simulateTransaction({ transaction: bytes, include: { balanceChanges: true } });
  if (sim.$kind !== "Transaction") throw new SettleError("this payment would fail on chain", 422);
  const moved = (owner: string) =>
    (sim.Transaction.balanceChanges ?? [])
      .filter((b) => b.coinType === expected.coinType && normalizeAddress(b.address) === owner)
      .reduce((s, b) => s + BigInt(b.amount), 0n);
  if (moved(expected.to) !== expected.amount || moved(expected.from) !== -expected.amount) throw new SettleError("the signed transaction doesn't move the agreed amount", 422);

  const started = Date.now();
  const result = await suiClient().executeTransaction({ transaction: bytes, signatures: [input.signature], include: { effects: true } });
  const executeMs = Date.now() - started;
  if (result.$kind !== "Transaction") throw new SettleError(`the network rejected it: ${JSON.stringify(result.FailedTransaction.effects?.status ?? null)}`, 422);
  const digest = result.Transaction.digest;

  const confirmed = await confirmTransfer(tatum(), digest, expected);
  if (!confirmed.ok) throw new SettleError(`sent as ${digest}, but Tatum couldn't confirm it yet: ${confirmed.error.message}`, 502);
  const c = confirmed.value;
  const settledAt = c.timestamp ?? new Date().toISOString();
  const amountMinor = (c.amount * BigInt(group.rate) * 100n) / 1_000_000n;

  await pool.query(
    `INSERT INTO payments (digest, group_key, from_member, to_member, from_address, to_address, micro_usdc, amount_minor, coin_type, checkpoint, settled_at, confirm_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (digest) DO NOTHING`,
    [digest, group.id, me.id, input.to, c.from, c.to, c.amount, amountMinor, c.coinType, c.checkpoint, settledAt, confirmed.ms],
  );
  revalidateTag(PAYMENTS_TAG, "max");

  const remember = memoryOn(group);
  if (remember) {
    const draft = receiptDraft({
      from: me.id,
      to: input.to,
      fromAddress: c.from,
      toAddress: c.to,
      microUsdc: c.amount,
      rateNgnPerUsdc: group.rate,
      coinType: c.coinType,
      digest,
      checkpoint: c.checkpoint === null ? undefined : String(c.checkpoint),
      settledAt,
      expenseIds: [],
    });
    await enqueue(pool, namespaceOf(group), [draft], new Date().toISOString());
  }

  return { digest, checkpoint: c.checkpoint, settledAt, executeMs, confirmMs: confirmed.ms, amountMinor, receipt: remember };
}
