import type { MemberId } from "../types.ts";

export interface MemberNames {
  id: MemberId;
  /** Display name plus learned nicknames; matched case-insensitively and exactly. */
  names: readonly string[];
}

export type QuickEntry =
  | {
      ok: true;
      amountMinor: bigint;
      description: string;
      payerId: MemberId | null;
      participants: MemberId[] | null;
    }
  | { ok: false; error: string; span: string };

const AMOUNT = /^₦?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([km])?$/i;
const DASHES = new Set(["—", "–", "-"]);

function parseAmount(token: string): bigint | null {
  const match = AMOUNT.exec(token);
  if (!match) return null;
  const whole = match[1]!.replaceAll(",", "");
  const frac = match[2] ?? "";
  const multiplier = { k: 1_000n, m: 1_000_000n }[(match[3] ?? "").toLowerCase()] ?? 1n;
  const scale = 10n ** BigInt(frac.length);
  const scaledKobo = BigInt(whole + frac) * multiplier * 100n;
  return scaledKobo % scale === 0n ? scaledKobo / scale : null;
}

/** R0: deterministic grammar for "25k diesel tolu paid", "₦4,500 LAWMA — me", "shoprite 38k split ada emeka". */
export function parseQuickEntry(line: string, members: readonly MemberNames[], selfId: MemberId): QuickEntry {
  const lookup = new Map<string, MemberId>();
  for (const m of members) for (const n of m.names) lookup.set(n.toLowerCase(), m.id);
  lookup.set("me", selfId);
  const nameAt = (t: string | undefined) => (t === undefined ? undefined : lookup.get(t.toLowerCase()));

  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  let amountMinor: bigint | null = null;
  let payerId: MemberId | null = null;
  let participants: MemberId[] | null = null;

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const token = tokens[i]!;
    const lower = token.toLowerCase();

    if (amountMinor === null) {
      const amount = parseAmount(token);
      if (amount !== null) {
        amountMinor = amount;
        used.add(i);
        continue;
      }
    }
    if (payerId === null && lower === "paid" && tokens[i + 1]?.toLowerCase() === "by" && nameAt(tokens[i + 2])) {
      payerId = nameAt(tokens[i + 2])!;
      used.add(i).add(i + 1).add(i + 2);
      continue;
    }
    if (payerId === null && nameAt(token) && tokens[i + 1]?.toLowerCase() === "paid") {
      payerId = nameAt(token)!;
      used.add(i).add(i + 1);
      continue;
    }
    if (payerId === null && DASHES.has(token) && nameAt(tokens[i + 1])) {
      payerId = nameAt(tokens[i + 1])!;
      used.add(i).add(i + 1);
      continue;
    }
    if (participants === null && (lower === "split" || lower === "for")) {
      const ids: MemberId[] = [];
      let k = i + 1;
      while (k < tokens.length && nameAt(tokens[k]) && !used.has(k)) ids.push(nameAt(tokens[k++])!);
      if (ids.length > 0) {
        participants = [...new Set(ids)];
        for (let u = i; u < k; u++) used.add(u);
        i = k - 1;
      }
    }
  }

  if (amountMinor === null) {
    return { ok: false, error: "No amount found. Try “25k diesel” or “₦4,500 LAWMA”.", span: line };
  }
  const description = tokens.filter((_, i) => !used.has(i)).join(" ");
  if (description === "") return { ok: false, error: "What was it for?", span: line };
  return { ok: true, amountMinor, description, payerId, participants };
}
