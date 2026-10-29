import { daysBetween, type LocalDate } from "@splitsense/engine";

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const toDate = (d: LocalDate) => new Date(`${d}T00:00:00Z`);

export const shortDate = (d: LocalDate) => dayMonth.format(toDate(d));
export const fullDate = (d: LocalDate) => longDate.format(toDate(d));

export function dueLabel(d: LocalDate, asOf: LocalDate): string {
  const days = daysBetween(asOf, d);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${-days} days late`;
  return `In ${days} days`;
}

const stampFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

/** An instant in Lagos time, e.g. "28 Oct, 17:40". */
export const stamp = (iso: string) => stampFormat.format(new Date(iso));

export const shortId = (id: string) => (id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

export const walruscanBlob = (blobId: string) => `https://walruscan.com/mainnet/blob/${encodeURIComponent(blobId)}`;
export const suiscanTx = (digest: string) => `https://suiscan.xyz/mainnet/tx/${encodeURIComponent(digest)}`;
export const suiscanAccount = (address: string) => `https://suiscan.xyz/mainnet/account/${encodeURIComponent(address)}`;
export const suiscanCheckpoint = (seq: number) => `https://suiscan.xyz/mainnet/checkpoint/${seq}`;

const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

/** Time of day in Lagos with seconds, e.g. "17:58:03". */
export const clock = (iso: string) => clockFormat.format(new Date(iso));

/** Base units to a decimal string with at most `max` decimals, trailing zeros trimmed down to `min`. */
function units(value: bigint, decimals: number, min: number, max: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = (abs / scale).toLocaleString("en-US");
  let frac = (abs % scale).toString().padStart(decimals, "0").slice(0, max);
  while (frac.length > min && frac.endsWith("0")) frac = frac.slice(0, -1);
  return `${neg ? "−" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Micro-USDC as "1.19"; `exact` keeps all six decimals that matter. */
export const usdcAmount = (micro: bigint, exact = false) => units(micro, 6, 2, exact ? 6 : 2);
export const suiAmount = (mist: bigint) => units(mist, 9, 0, 4);

/** "1.25" or "1.250000" → micro-USDC; null when it isn't a USDC amount. */
export function parseUsdc(text: string): bigint | null {
  const m = text.trim().match(/^(\d{0,12})(?:\.(\d{0,6}))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return BigInt(m[1] || "0") * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** A ledger amount (NGN kobo) shown in USDC at the group rate, to the nearest cent, e.g. "16.67 USDC". Callers word the sign. */
export function usdc(kobo: bigint, rateNgnPerUsdc: number): string {
  const abs = kobo < 0n ? -kobo : kobo;
  const rate = BigInt(rateNgnPerUsdc);
  return `${units((abs * 2n + rate) / (2n * rate), 2, 2, 2)} USDC`;
}

/** Engine and memory text keep the ledger's naira ("usually ₦25,000"); this shows those amounts in USDC. */
export const usdcText = (text: string, rateNgnPerUsdc: number) =>
  text.replace(/₦(\d[\d,]*)(?:\.(\d{1,2}))?/g, (_, whole: string, frac: string | undefined) =>
    usdc(BigInt(whole.replace(/,/g, "")) * 100n + BigInt((frac ?? "").padEnd(2, "0")), rateNgnPerUsdc),
  );

/** "16.67" USDC typed into a bill → NGN kobo for the ledger at the group rate; null when it isn't an amount. */
export function usdcToKobo(text: string, rateNgnPerUsdc: number): bigint | null {
  const micro = parseUsdc(text.replace(/[,\s]/g, ""));
  return micro === null ? null : (micro * BigInt(rateNgnPerUsdc)) / 10_000n;
}
