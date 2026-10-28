import type { Result, Tatum } from "./tatum.ts";

/** GraphQL `chainIdentifier` on Sui Mainnet (the genesis checkpoint digest). */
export const SUI_MAINNET_CHAIN_ID = "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S";
export const SUI_COIN_TYPE = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
export const USDC_MAINNET_COIN_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

/** The GraphQL each read sends, exported so `/status` can show exactly what ran. */
export const QUERIES = {
  chainHead: `{ chainIdentifier checkpoint { sequenceNumber timestamp } }`,
  transaction: `query ($digest: String!) {
  transaction(digest: $digest) {
    digest
    effects {
      status
      timestamp
      checkpoint { sequenceNumber }
      balanceChanges(first: 20) { nodes { amount owner { address } coinType { repr } } }
    }
  }
}`,
  balance: `query ($address: SuiAddress!, $coinType: String!) {
  address(address: $address) { balance(coinType: $coinType) { totalBalance } }
}`,
} as const;

export interface ChainHead {
  chainId: string;
  checkpoint: number;
  timestamp: string | null;
}

export interface BalanceChange {
  owner: string | null;
  coinType: string;
  amount: bigint;
}

export interface TxSummary {
  digest: string;
  status: "SUCCESS" | "FAILURE" | string;
  checkpoint: number | null;
  timestamp: string | null;
  balanceChanges: BalanceChange[];
}

class ReadFailure extends Error {
  readonly kind: "not_found" | "parse";
  constructor(kind: "not_found" | "parse", message: string) {
    super(message);
    this.kind = kind;
  }
}

function map<A, B>(r: Result<A>, f: (a: A) => B): Result<B> {
  if (!r.ok) return r;
  const meta = { ms: r.ms, attempts: r.attempts, plan: r.plan };
  try {
    return { ok: true, value: f(r.value), ...meta };
  } catch (e) {
    return { ok: false, error: { kind: e instanceof ReadFailure ? e.kind : "parse", message: (e as Error).message }, ...meta };
  }
}

export async function getChainHead(tatum: Tatum): Promise<Result<ChainHead>> {
  const r = await tatum.request<{ chainIdentifier: string; checkpoint: { sequenceNumber: number | string; timestamp: string | null } | null }>(QUERIES.chainHead);
  return map(r, (d) => {
    if (!d.checkpoint) throw new ReadFailure("parse", "no checkpoint in response");
    return { chainId: d.chainIdentifier, checkpoint: Number(d.checkpoint.sequenceNumber), timestamp: d.checkpoint.timestamp };
  });
}

type TxData = {
  transaction: {
    digest: string;
    effects: {
      status: string;
      timestamp: string | null;
      checkpoint: { sequenceNumber: number | string } | null;
      balanceChanges: { nodes: { amount: string; owner: { address: string } | null; coinType: { repr: string } }[] };
    } | null;
  } | null;
};

export async function getTransaction(tatum: Tatum, digest: string): Promise<Result<TxSummary>> {
  const r = await tatum.request<TxData>(QUERIES.transaction, { digest });
  return map(r, (d) => {
    const tx = d.transaction;
    if (!tx?.effects) throw new ReadFailure("not_found", `transaction ${digest} not found`);
    return {
      digest: tx.digest,
      status: tx.effects.status,
      checkpoint: tx.effects.checkpoint ? Number(tx.effects.checkpoint.sequenceNumber) : null,
      timestamp: tx.effects.timestamp,
      balanceChanges: tx.effects.balanceChanges.nodes.map((n) => ({ owner: n.owner?.address ?? null, coinType: n.coinType.repr, amount: BigInt(n.amount) })),
    };
  });
}

export async function getBalance(tatum: Tatum, address: string, coinType: string): Promise<Result<bigint>> {
  const r = await tatum.request<{ address: { balance: { totalBalance: string | null } | null } | null }>(QUERIES.balance, { address, coinType });
  return map(r, (d) => BigInt(d.address?.balance?.totalBalance ?? "0"));
}

/** Base units as a display string, truncated to `shown` decimals, e.g. (2_500_000n, 6, 2) → "2.50". */
export function formatUnits(amount: bigint, decimals: number, shown = decimals): string {
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  const unit = 10n ** BigInt(decimals);
  const whole = (abs / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % unit).toString().padStart(decimals, "0").slice(0, shown);
  return `${sign}${whole}${shown > 0 ? `.${frac}` : ""}`;
}

/** USDC micro-units (6 decimals) as a display string, e.g. 2_500_000n → "2.50". */
export const formatUsdc = (micro: bigint, shown = 2) => formatUnits(micro, 6, shown);

const KNOWN_COINS: Record<string, { symbol: string; decimals: number }> = {
  [SUI_COIN_TYPE]: { symbol: "SUI", decimals: 9 },
  [USDC_MAINNET_COIN_TYPE]: { symbol: "USDC", decimals: 6 },
};

/** "−0.000011 USDC" for known coins; raw base units plus the type's last segment otherwise. */
export function formatCoin(amount: bigint, coinType: string): string {
  const coin = KNOWN_COINS[coinType];
  if (!coin) return `${amount} ${coinType.split("::").pop()}`;
  const [whole, frac = ""] = formatUnits(amount, coin.decimals).split(".");
  const trimmed = frac.replace(/0+$/, "");
  return `${whole}${trimmed ? `.${trimmed}` : ""} ${coin.symbol}`;
}
