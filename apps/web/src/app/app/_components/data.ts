"use client";

import type { Category } from "@splitsense/engine";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type GroupKind = "flat" | "event";

export interface Debt {
  memberId: string;
  name: string;
  address: string | null;
  amountMinor: string;
  microUsdc: string;
}

export interface Balances {
  address: string;
  balances: { ok: true; usdcMicro: string; suiMist: string; ms: number; plan: string | null } | { ok: false; error: string; ms: number };
}

export interface GroupSummary {
  id: string;
  name: string;
  kind: GroupKind;
  place: string | null;
  demo: boolean;
  rate: number;
  me: { id: string; name: string };
  members: { id: string; name: string }[];
  net: string;
  owe: Debt[];
  owed: Debt[];
  billCount: number;
}

export interface MeData {
  address: string;
  profile: { name: string | null; suggested: string | null };
  groups: GroupSummary[];
}

export interface Bill {
  id: string;
  date: string;
  description: string;
  category: Category;
  amountMinor: string;
  payer: { id: string; name: string };
  shareMinor: string;
  people: number;
  mine: boolean;
}

export interface PaymentItem {
  digest: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  fromAddress: string;
  toAddress: string;
  microUsdc: string;
  amountMinor: string;
  checkpoint: number | null;
  settledAt: string;
  confirmMs: number | null;
  receipt?: { status: string; blobId: string | null } | null;
}

export interface GroupData {
  id: string;
  name: string;
  kind: GroupKind;
  place: string | null;
  rate: number;
  demo: boolean;
  memory: boolean;
  invite: string | null;
  asOf: string;
  categories: Category[];
  me: { id: string; name: string; address: string | null };
  members: { id: string; name: string; address: string | null; net: string }[];
  net: string;
  owe: Debt[];
  owed: Debt[];
  spentMinor: string;
  billCount: number;
  bills: Bill[];
  payments: PaymentItem[];
  turns: { category: Category; nextPayerId: string; summary: string }[];
  upcoming: { category: Category; nextExpectedDate: string; expectedAmountMinor: string; summary: string }[];
}

export interface ActivityItem extends PaymentItem {
  groupId: string;
  groupName: string;
  me: string;
  memory: boolean;
}

export interface ActivityData {
  groups: { id: string; name: string; kind: GroupKind }[];
  payments: ActivityItem[];
}

const cache = new Map<string, unknown>();

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Drops every cached response and refetches what's on screen, after anything changes server data. */
export function refreshAll() {
  cache.clear();
  version++;
  listeners.forEach((fn) => fn());
}

/** GET JSON with the last good response kept across screens, so tabs switch without a blank state. */
export function useJson<T>(url: string | null) {
  const v = useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error: string | null; status?: number } | null>(null);
  const key = url ? `${url}#${v}.${tick}` : null;

  useEffect(() => {
    if (!url || !key) return;
    let live = true;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw Object.assign(new Error(body?.error ?? `HTTP ${r.status}`), { status: r.status });
        cache.set(url, body);
        if (live) setResult({ key, data: body as T, error: null });
      })
      .catch((e) => live && setResult({ key, error: e instanceof Error ? e.message : String(e), status: (e as { status?: number }).status }));
    return () => {
      live = false;
    };
  }, [url, key]);

  const fresh = result !== null && result.key === key;
  const data = (fresh ? result.data : undefined) ?? (url ? (cache.get(url) as T | undefined) : undefined);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error: fresh ? result.error : null, status: fresh ? result.status : undefined, loading: Boolean(url) && !fresh, reload };
}

/** The session is per address, so each address keys its own cache entries. */
export const useMe = (address: string | undefined) => useJson<MeData>(address ? `/api/me?as=${address}` : null);
export const useBalances = (address: string | undefined) => useJson<Balances>(address ? `/api/wallet?address=${address}` : null);
export const useGroup = (id: string | null, address: string | undefined) => useJson<GroupData>(id && address ? `/api/groups/${id}?as=${address}` : null);
export const useActivity = (address: string | undefined) => useJson<ActivityData>(address ? `/api/activity?as=${address}` : null);

/** JSON request that throws the server's error message. */
export async function send<T>(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data as T;
}
