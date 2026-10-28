import { daysBetween, formatNaira, koboToMicroUsdc, type LocalDate } from "@splitsense/engine";

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

export const naira = (kobo: bigint) => formatNaira(kobo < 0n ? -kobo : kobo);

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

/** "12,500" or "₦12500.50" → kobo; null when it isn't a naira amount. */
export function parseNaira(text: string): bigint | null {
  const m = text.replace(/[,\s₦]/g, "").match(/^(\d{0,11})(?:\.(\d{0,2}))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return BigInt(m[1] || "0") * 100n + BigInt((m[2] ?? "").padEnd(2, "0"));
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function usdc(kobo: bigint, rateNgnPerUsdc: number): string {
  const micro = koboToMicroUsdc(kobo, BigInt(rateNgnPerUsdc));
  return `${(Number(micro / 10_000n) / 100).toFixed(2)} USDC`;
}
