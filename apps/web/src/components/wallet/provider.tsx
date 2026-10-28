"use client";

import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import {
  getWallets,
  signTransaction,
  SUI_MAINNET_CHAIN,
  type WalletAccount,
  type WalletWithRequiredFeatures,
} from "@mysten/wallet-standard";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "splitsense.wallet";

export type WalletStatus = "restoring" | "disconnected" | "connecting" | "connected";

interface WalletState {
  wallets: WalletWithRequiredFeatures[];
  status: WalletStatus;
  wallet: WalletWithRequiredFeatures | null;
  account: WalletAccount | null;
  error: string | null;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (wallet: WalletWithRequiredFeatures) => Promise<boolean>;
  disconnect: () => Promise<void>;
  /** Signs base64 transaction bytes built by the server; returns base64 bytes and signature. */
  sign: (bytes: string) => Promise<{ bytes: string; signature: string }>;
  /** Signs a plain-text message (no gas, no transaction); returns base64 bytes and signature. */
  signMessage: (text: string) => Promise<{ bytes: string; signature: string }>;
}

const WalletContext = createContext<WalletState | null>(null);

const isSuiWallet = (w: { chains: readonly string[]; features: Record<string, unknown> }): w is WalletWithRequiredFeatures =>
  w.chains.includes(SUI_MAINNET_CHAIN) && "standard:connect" in w.features && "standard:events" in w.features;

const mainnetAccount = (accounts: readonly WalletAccount[]) => accounts.find((a) => a.chains.includes(SUI_MAINNET_CHAIN)) ?? accounts[0] ?? null;

const saved = (): { name: string; address: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
};

const message = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /reject|denied|cancel/i.test(m) ? "You cancelled the request in your wallet." : m;
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithRequiredFeatures[]>([]);
  const [status, setStatus] = useState<WalletStatus>("restoring");
  const [wallet, setWallet] = useState<WalletWithRequiredFeatures | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const registry = getWallets();
    const sync = () => setWallets(registry.get().filter(isSuiWallet));
    sync();
    const offRegister = registry.on("register", sync);
    const offUnregister = registry.on("unregister", sync);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  // Restore the last session silently once its wallet has registered; give up after a moment.
  useEffect(() => {
    if (status !== "restoring") return;
    const last = saved();
    const w = last && wallets.find((x) => x.name === last.name);
    if (!last || !w) {
      const t = setTimeout(() => setStatus((s) => (s === "restoring" ? "disconnected" : s)), last ? 1500 : 0);
      return () => clearTimeout(t);
    }
    let live = true;
    w.features["standard:connect"]
      .connect({ silent: true })
      .then(({ accounts }) => {
        if (!live) return;
        const a = accounts.find((x) => x.address === last.address) ?? null;
        if (!a) return setStatus("disconnected");
        setWallet(w);
        setAccount(a);
        setStatus("connected");
      })
      .catch(() => live && setStatus("disconnected"));
    return () => {
      live = false;
    };
  }, [wallets, status]);

  // Follow account switches and disconnects made inside the wallet.
  useEffect(() => {
    if (!wallet) return;
    return wallet.features["standard:events"].on("change", ({ accounts }) => {
      if (!accounts) return;
      const a = mainnetAccount(accounts);
      if (!a) {
        localStorage.removeItem(STORAGE_KEY);
        setWallet(null);
        setAccount(null);
        setStatus("disconnected");
        return;
      }
      setAccount(a);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: wallet.name, address: a.address }));
    });
  }, [wallet]);

  const connect = useCallback(async (w: WalletWithRequiredFeatures) => {
    setError(null);
    setStatus("connecting");
    try {
      const { accounts } = await w.features["standard:connect"].connect();
      const a = mainnetAccount(accounts);
      if (!a) throw new Error(`${w.name} didn't share a Sui account.`);
      setWallet(w);
      setAccount(a);
      setStatus("connected");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: w.name, address: a.address }));
      return true;
    } catch (e) {
      setError(message(e));
      setStatus("disconnected");
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await wallet?.features["standard:disconnect"]?.disconnect();
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setWallet(null);
      setAccount(null);
      setStatus("disconnected");
    }
  }, [wallet]);

  const sign = useCallback(
    async (bytes: string) => {
      if (!wallet || !account) throw new Error("Connect a wallet first.");
      const transaction = Transaction.from(fromBase64(bytes));
      try {
        return await signTransaction(wallet, { transaction: { toJSON: () => transaction.toJSON() }, account, chain: SUI_MAINNET_CHAIN });
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [wallet, account],
  );

  const signMessage = useCallback(
    async (text: string) => {
      if (!wallet || !account) throw new Error("Connect a wallet first.");
      const feature = wallet.features["sui:signPersonalMessage"];
      if (!feature) throw new Error(`${wallet.name} can't sign messages. Try Slush.`);
      try {
        return await feature.signPersonalMessage({ message: new TextEncoder().encode(text), account, chain: SUI_MAINNET_CHAIN });
      } catch (e) {
        throw new Error(message(e));
      }
    },
    [wallet, account],
  );

  const value = useMemo<WalletState>(
    () => ({
      wallets,
      status,
      wallet,
      account,
      error,
      modalOpen,
      openModal: () => {
        setError(null);
        setModalOpen(true);
      },
      closeModal: () => setModalOpen(false),
      connect,
      disconnect,
      sign,
      signMessage,
    }),
    [wallets, status, wallet, account, error, modalOpen, connect, disconnect, sign, signMessage],
  );

  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet() {
  const ctx = use(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
