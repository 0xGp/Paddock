"use client";

import { Activity, HandCoins, House, LoaderCircle, PenLine, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useState, type FormEvent, type ReactNode } from "react";
import { Brand } from "@/app/demo/_components/parts";
import { ConnectButton } from "@/components/wallet/connect";
import { useWallet } from "@/components/wallet/provider";
import { useSession } from "@/components/wallet/session";
import { cn } from "@/lib/cn";
import { refreshAll, send, useMe } from "./data";

const TABS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/settle", label: "Settle", icon: HandCoins },
  { href: "/app/activity", label: "Activity", icon: Activity },
] as const;

type Stage = "loading" | "connect" | "sign-in" | "name" | "error" | "ready";

function useAccessState() {
  const { status, account } = useWallet();
  const session = useSession();
  const me = useMe(session.status === "signed-in" ? account?.address : undefined);
  const stage: Stage =
    status === "restoring"
      ? "loading"
      : status !== "connected"
        ? "connect"
        : session.status === "checking"
          ? "loading"
          : session.status !== "signed-in" || me.status === 401
            ? "sign-in"
            : !me.data
              ? me.error
                ? "error"
                : "loading"
              : !me.data.profile.name
                ? "name"
                : "ready";
  return { stage, me, address: account?.address };
}

type Access = ReturnType<typeof useAccessState>;
const AccessContext = createContext<Access | null>(null);

/** Where the visitor is on connect → sign in → name, and the signed-in wallet's data once ready. */
export function useAccess() {
  const ctx = use(AccessContext);
  if (!ctx) throw new Error("useAccess must be used inside <AppShell>");
  return ctx;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const access = useAccessState();
  const ready = access.stage === "ready";
  const active = (href: string) => (href === "/app" ? pathname === "/app" || pathname.startsWith("/app/g/") || pathname === "/app/new" : pathname.startsWith(href));
  const open = pathname.startsWith("/app/join/");
  const owes = Boolean(access.me.data?.groups.some((g) => g.owe.length > 0));
  const icon = (href: string, Icon: (typeof TABS)[number]["icon"], size: string) => (
    <span className="relative">
      <Icon aria-hidden className={size} strokeWidth={2} />
      {href === "/app/settle" && owes && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-owes" />}
    </span>
  );

  return (
    <AccessContext value={access}>
      <div className="min-h-dvh">
        <div aria-hidden className="backdrop" />

        <header className="sticky top-0 z-20">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
            <Link href="/" aria-label="SplitSense home">
              <Brand tag="Sui Mainnet" />
            </Link>
            <nav aria-label="App" className={cn("glass hidden rounded-full p-1", ready && "md:block")}>
              <ul className="flex items-center gap-1">
                {TABS.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active(href) ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                        active(href) ? "bg-navy text-white" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {icon(href, Icon, "size-4")}
                      {label}
                      {href === "/app/settle" && owes && <span className="sr-only">, you owe someone</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <ConnectButton />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pt-2 pb-36 sm:px-6 md:pb-16">{open ? children : <AccessGate>{children}</AccessGate>}</main>

        <nav
          aria-label="App"
          hidden={!ready}
          className="glass-dark fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto w-fit rounded-full p-1.5 md:hidden"
        >
          <ul className="flex items-center gap-1">
            {TABS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                  className={cn(
                    "flex h-12 min-w-20 flex-col items-center justify-center gap-0.5 rounded-full px-4 text-[0.6875rem] font-semibold transition-colors",
                    active(href) ? "bg-white text-navy" : "text-white/75 hover:text-white",
                  )}
                >
                  {icon(href, Icon, "size-[1.125rem]")}
                  {label}
                  {href === "/app/settle" && owes && <span className="sr-only">, you owe someone</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </AccessContext>
  );
}

/** Shows the next step (connect, sign in, name) until the wallet is ready, then the page. */
export function AccessGate({ children, intro, reason }: { children: ReactNode; intro?: ReactNode; reason?: string }) {
  const { stage, me } = useAccess();
  if (stage === "ready") return children;
  return (
    <div className="mx-auto mt-2 max-w-md space-y-4 sm:mt-10">
      {intro}
      {stage === "loading" && <div aria-busy className="glass h-72 animate-pulse rounded-[2rem]" />}
      {stage === "connect" && <ConnectStep reason={reason} />}
      {stage === "sign-in" && <SignInStep />}
      {stage === "name" && <NameStep suggested={me.data?.profile.suggested ?? ""} />}
      {stage === "error" && (
        <GateCard icon={<ShieldCheck aria-hidden className="size-7" strokeWidth={1.75} />} title="Couldn't load your account" body={me.error ?? "Something went wrong."}>
          <button type="button" onClick={me.reload} className="flex h-12 w-full items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
            Try again
          </button>
        </GateCard>
      )}
    </div>
  );
}

function GateCard({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <section aria-labelledby="gate-title" className="glass rounded-[2rem] p-3">
      <div className="hero-card grid h-36 place-items-center rounded-[1.5rem]">
        <span className="grid size-16 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md">{icon}</span>
      </div>
      <div className="px-3 pt-6 pb-3 text-center">
        <h1 id="gate-title" className="text-xl font-bold text-balance">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-pretty text-ink-muted">{body}</p>
        <div className="mt-6 space-y-2">{children}</div>
      </div>
    </section>
  );
}

function ConnectStep({ reason }: { reason?: string }) {
  return (
    <GateCard
      icon={<Wallet aria-hidden className="size-7" strokeWidth={1.75} />}
      title="Connect your wallet"
      body={reason ?? "Split bills with your flatmates or friends at an event, then settle up in USDC on Sui."}
    >
      <ConnectButton size="lg" />
      <Link href="/demo" className="flex h-12 items-center justify-center rounded-full text-sm font-semibold text-sui hover:bg-white/40">
        Try the demo flat instead
      </Link>
    </GateCard>
  );
}

function SignInStep() {
  const { wallet } = useWallet();
  const { status, error, signIn } = useSession();
  const busy = status === "signing";
  return (
    <GateCard
      icon={<ShieldCheck aria-hidden className="size-7" strokeWidth={1.75} />}
      title="Confirm it's your wallet"
      body={`${wallet?.name ?? "Your wallet"} will ask you to sign a short message. It's free, needs no gas and can't move any funds.`}
    >
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-70"
      >
        {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {busy ? `Check ${wallet?.name ?? "your wallet"}…` : "Sign in"}
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-owes/[0.08] px-4 py-3 text-sm text-owes">
          {error}
        </p>
      )}
    </GateCard>
  );
}

function NameStep({ suggested }: { suggested: string }) {
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send("/api/me", "PUT", { name });
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <GateCard icon={<PenLine aria-hidden className="size-7" strokeWidth={1.75} />} title="What should friends call you?" body="This is the name your flatmates and friends see on bills and payments. You can change it later.">
      <form onSubmit={save} className="space-y-3 text-left">
        <label htmlFor="display-name" className="sr-only">
          Your name
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          autoFocus
          maxLength={32}
          placeholder="e.g. Tolu"
          className="h-14 w-full rounded-2xl bg-white/70 px-4 text-lg font-semibold ring-1 ring-ink/[0.06] outline-none placeholder:font-normal placeholder:text-ink-muted/60 focus:ring-sui/50"
        />
        {error && (
          <p role="alert" className="text-sm text-owes">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          Continue
        </button>
      </form>
    </GateCard>
  );
}

/** A glass panel with a title row, used by every app screen. */
export function Panel({ title, action, className, children }: { title?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("glass rounded-[1.75rem] p-2", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-sui-soft text-sui">{icon}</span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-pretty text-ink-muted">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
