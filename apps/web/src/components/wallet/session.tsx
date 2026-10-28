"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWallet } from "./provider";

export type SessionStatus = "idle" | "checking" | "signed-out" | "signing" | "signed-in";

interface SessionState {
  status: SessionStatus;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

const post = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data as T;
};

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** Whether the connected wallet has proved it owns its address to the server (a signed message, no gas). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { account, signMessage } = useWallet();
  const address = account?.address ?? null;
  const [checked, setChecked] = useState<{ for: string; session: string | null } | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let live = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { address: string | null }) => live && setChecked({ for: address, session: d.address }))
      .catch(() => live && setChecked({ for: address, session: null }));
    return () => {
      live = false;
    };
  }, [address]);

  const signIn = useCallback(async () => {
    if (!address) return;
    setError(null);
    setSigning(true);
    try {
      const { message } = await post<{ message: string }>("/api/auth/challenge", { address });
      const signed = await signMessage(message);
      const { address: session } = await post<{ address: string }>("/api/auth/verify", { address, bytes: signed.bytes, signature: signed.signature });
      setChecked({ for: address, session });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigning(false);
    }
  }, [address, signMessage]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    setChecked(null);
  }, []);

  const status: SessionStatus = !address
    ? "idle"
    : signing
      ? "signing"
      : checked?.for !== address
        ? "checking"
        : same(checked.session, address)
          ? "signed-in"
          : "signed-out";

  const value = useMemo(() => ({ status, error, signIn, signOut }), [status, error, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
