import { getTransaction, type TxSummary } from "./sui.ts";
import type { Result, Tatum } from "./tatum.ts";

export interface ExpectedTransfer {
  from: string;
  to: string;
  /** Base units, e.g. micro-USDC. */
  amount: bigint;
  coinType: string;
}

export interface ConfirmedTransfer extends ExpectedTransfer {
  digest: string;
  checkpoint: number | null;
  timestamp: string | null;
}

/** Lowercase, `0x`-prefixed, zero-padded to 32 bytes, so short and long forms compare equal. */
export function normalizeAddress(a: string): string {
  const hex = a.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{1,64}$/.test(hex)) throw new Error(`not a Sui address: ${a}`);
  return `0x${hex.padStart(64, "0")}`;
}

/**
 * Whether a transaction moved exactly `amount` of `coinType` from `from` to `to`.
 * Gas is paid in SUI, so a USDC transfer's USDC changes are exact for both parties.
 */
export function checkTransfer(tx: TxSummary, expected: ExpectedTransfer): { ok: true } | { ok: false; reason: string } {
  const from = normalizeAddress(expected.from);
  const to = normalizeAddress(expected.to);
  if (from === to) return { ok: false, reason: "payer and payee are the same address" };
  if (expected.amount <= 0n) return { ok: false, reason: "amount must be positive" };
  if (tx.status !== "SUCCESS") return { ok: false, reason: `transaction status ${tx.status}` };
  const net = (owner: string) =>
    tx.balanceChanges.filter((b) => b.coinType === expected.coinType && b.owner && normalizeAddress(b.owner) === owner).reduce((s, b) => s + b.amount, 0n);
  const sent = net(from);
  const received = net(to);
  if (received !== expected.amount) return { ok: false, reason: `payee received ${received}, expected ${expected.amount}` };
  if (sent !== -expected.amount) return { ok: false, reason: `payer sent ${-sent}, expected ${expected.amount}` };
  return { ok: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads the transaction through Tatum and checks it against what the app expected. A digest the
 * indexer hasn't seen yet is polled for up to `waitMs`, since confirmation runs right after signing.
 */
export async function confirmTransfer(tatum: Tatum, digest: string, expected: ExpectedTransfer, { waitMs = 15_000, pollMs = 1_000 } = {}): Promise<Result<ConfirmedTransfer>> {
  const started = Date.now();
  let attempts = 0;
  for (;;) {
    const r = await getTransaction(tatum, digest);
    attempts += r.attempts;
    const meta = { ms: Date.now() - started, attempts, plan: r.plan };
    if (!r.ok) {
      if (r.error.kind === "not_found" && Date.now() - started + pollMs < waitMs) {
        await sleep(pollMs);
        continue;
      }
      return { ok: false, error: r.error, ...meta };
    }
    const check = checkTransfer(r.value, expected);
    if (!check.ok) return { ok: false, error: { kind: "mismatch", message: check.reason }, ...meta };
    return {
      ok: true,
      value: { ...expected, from: normalizeAddress(expected.from), to: normalizeAddress(expected.to), digest: r.value.digest, checkpoint: r.value.checkpoint, timestamp: r.value.timestamp },
      ...meta,
    };
  }
}
