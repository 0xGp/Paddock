"use client";

import { Check, ChevronRight, Copy, ExternalLink, LoaderCircle, LogOut, ShieldCheck, Wallet, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { shortAddress, suiscanAccount } from "@/lib/format";
import { useWallet } from "./provider";
import { useSession } from "./session";

const SLUSH_URL = "https://slush.app";

/** A stable two-tone mark for an address, so a wallet is recognisable at a glance. */
export function AddressMark({ address, className }: { address: string; className?: string }) {
  const a = parseInt(address.slice(2, 6), 16) % 360;
  const b = (a + 40 + (parseInt(address.slice(6, 8), 16) % 80)) % 360;
  return (
    <span
      aria-hidden
      className={cn("inline-block size-7 shrink-0 rounded-full ring-2 ring-white/80", className)}
      style={{ background: `conic-gradient(from 210deg, oklch(0.72 0.14 ${a}), oklch(0.6 0.17 ${b}), oklch(0.72 0.14 ${a}))` }}
    />
  );
}

export function ConnectButton({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const { status, account, openModal } = useWallet();

  if (status === "restoring") {
    return <span aria-hidden className={cn("glass block h-10 w-36 animate-pulse rounded-full", size === "lg" && "h-14 w-full", className)} />;
  }
  if (status === "connected" && account) return <AccountButton address={account.address} className={className} />;

  return (
    <button
      type="button"
      onClick={openModal}
      disabled={status === "connecting"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-navy font-semibold text-white shadow-[0_8px_24px_-10px_oklch(0.24_0.08_264/0.8)] transition-transform duration-150 hover:bg-[oklch(0.3_0.1_262)] active:scale-[0.97] disabled:opacity-70",
        size === "lg" ? "h-14 w-full px-6 text-base" : "h-10 px-4 text-sm",
        className,
      )}
    >
      {status === "connecting" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Wallet aria-hidden className="size-4" strokeWidth={2} />}
      {status === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

function AccountButton({ address, className }: { address: string; className?: string }) {
  const { wallet, disconnect } = useWallet();
  const { signOut } = useSession();
  const [copied, setCopied] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button
        type="button"
        popoverTarget="account-menu"
        className={cn("glass inline-flex h-10 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.97]", className)}
      >
        <AddressMark address={address} />
        <span className="font-mono text-[0.8125rem]">{shortAddress(address)}</span>
      </button>
      <div ref={menu} id="account-menu" popover="auto" className="menu fixed top-16 right-4 w-[min(20rem,calc(100vw-2rem))]">
        <div className="glass-strong rounded-3xl p-2">
          <div className="flex items-center gap-3 px-3 pt-3 pb-4">
            <AddressMark address={address} className="size-10" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{wallet?.name ?? "Wallet"}</p>
              <p className="truncate font-mono text-xs text-ink-muted">{shortAddress(address)} · Sui Mainnet</p>
            </div>
          </div>
          <button type="button" onClick={copy} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium hover:bg-ink/[0.05]">
            {copied ? <Check aria-hidden className="size-4 text-sui" /> : <Copy aria-hidden className="size-4 text-ink-muted" />}
            {copied ? "Copied" : "Copy address"}
          </button>
          <a href={suiscanAccount(address)} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium hover:bg-ink/[0.05]">
            <ExternalLink aria-hidden className="size-4 text-ink-muted" />
            View on Suiscan
          </a>
          <button
            type="button"
            onClick={() => {
              menu.current?.hidePopover();
              void signOut().then(disconnect);
            }}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium text-owes hover:bg-owes/[0.06]"
          >
            <LogOut aria-hidden className="size-4" />
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
}

/** The wallet picker. Rendered once; opened through `openModal()`. */
export function WalletModal() {
  const { wallets, modalOpen, closeModal, connect, status, error } = useWallet();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (modalOpen && !d.open) d.showModal();
    if (!modalOpen && d.open) d.close();
  }, [modalOpen]);

  const pick = async (w: (typeof wallets)[number]) => {
    setPending(w.name);
    const ok = await connect(w);
    setPending(null);
    if (!ok) return;
    closeModal();
    if (!pathname.startsWith("/app")) router.push("/app");
  };

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby="wallet-modal-title"
      onClose={closeModal}
      onClick={(e) => e.target === e.currentTarget && closeModal()}
    >
      <div className="glass-strong mx-auto w-full rounded-t-[2rem] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:w-[25rem] sm:rounded-[2rem] sm:pb-2">
        <div aria-hidden className="mx-auto mt-1 h-1 w-10 rounded-full bg-ink/15 sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-4 pt-4">
          <div>
            <h2 id="wallet-modal-title" className="text-lg font-bold">
              Connect a wallet
            </h2>
            <p className="mt-1 text-sm text-pretty text-ink-muted">Your wallet is your Paddock account. We never see your keys.</p>
          </div>
          <button type="button" onClick={closeModal} aria-label="Close" className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full hover:bg-ink/[0.06]">
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <ul role="list" className="mt-4 space-y-1">
          {wallets.map((w) => (
            <li key={w.name}>
              <button
                type="button"
                onClick={() => pick(w)}
                disabled={status === "connecting"}
                className="flex h-16 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-ink/[0.05] disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs */}
                <img src={w.icon} alt="" className="size-10 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{w.name}</span>
                  <span className="block text-xs text-ink-muted">Detected in this browser</span>
                </span>
                {pending === w.name ? <LoaderCircle aria-label="Connecting" className="size-5 animate-spin text-sui" /> : <ChevronRight aria-hidden className="size-4 text-ink-muted" />}
              </button>
            </li>
          ))}
        </ul>

        {wallets.length === 0 && (
          <div className="mx-2 mt-2 rounded-3xl bg-sui-soft p-5">
            <p className="font-semibold">No Sui wallet in this browser</p>
            <p className="mt-1 text-sm text-pretty text-ink-muted">Slush is the Sui wallet we test with. Install it, then come back and connect.</p>
            <a
              href={SLUSH_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white transition-transform active:scale-[0.97]"
            >
              Get Slush
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </div>
        )}

        {error && (
          <p role="alert" className="mx-2 mt-3 rounded-2xl bg-owes/[0.08] px-4 py-3 text-sm text-owes">
            {error}
          </p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 px-4 pb-3 text-xs text-ink-muted">
          <ShieldCheck aria-hidden className="size-3.5" />
          Sui Mainnet · read and confirmed through Tatum
        </p>
      </div>
    </dialog>
  );
}
