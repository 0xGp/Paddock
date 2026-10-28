"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, Database, Fuel, Gauge, Sigma } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, Brand } from "@/app/demo/_components/parts";
import { ConnectButton } from "@/components/wallet/connect";
import { useWallet } from "@/components/wallet/provider";
import { cn } from "@/lib/cn";

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  art: ReactNode;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Shared costs",
    title: "Split the bills, keep the friendships",
    body: "One place for your flat's diesel, data and service charge, and a clear answer to who pays whom.",
    art: <SplitArt />,
  },
  {
    eyebrow: "Memory",
    title: "It learns how your flat lives",
    body: "Whose turn it is, which bills come back, who settles fast. Learned from your history and kept on Walrus.",
    art: <MemoryArt />,
  },
  {
    eyebrow: "Settle",
    title: "Pay back in USDC on Sui",
    body: "Straight from your own wallet, with no gas fee. Every payment is confirmed through Tatum in seconds.",
    art: <SettleArt />,
  },
  {
    eyebrow: "Trust",
    title: "Every number shows its working",
    body: "Tap any balance to see the maths and the memory behind it. Nothing is a black box.",
    art: <WorkingArt />,
  },
];

export function Onboarding() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const { status } = useWallet();
  const last = SLIDES.length - 1;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, Math.min(last, i)) * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }, [last]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="backdrop" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8">
        <Brand tag="Sui Mainnet" />
        {status === "connected" ? (
          <Link href="/app" className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
            Open app
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <button type="button" onClick={() => go(last)} className={cn("h-10 rounded-full px-4 text-sm font-semibold text-ink-muted transition-opacity hover:text-ink", index === last && "pointer-events-none opacity-0")}>
            Skip
          </button>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-6 sm:px-8">
        <section
          aria-roledescription="carousel"
          aria-label="Welcome to SplitSense"
          className="w-full max-w-[26rem]"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(index + 1);
            if (e.key === "ArrowLeft") go(index - 1);
          }}
        >
          <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[2.25rem]">
            {SLIDES.map((s, i) => (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDES.length}`}
                inert={i !== index}
                className="w-full shrink-0 snap-center p-1"
              >
                <article className="glass flex h-full flex-col rounded-[2rem] p-3">
                  <div className="relative grid h-64 place-items-center overflow-hidden rounded-[1.5rem] bg-[linear-gradient(160deg,oklch(1_0_0/0.7),oklch(0.95_0.03_240/0.5))] sm:h-72">
                    {s.art}
                  </div>
                  <div className="px-3 pt-6 pb-4">
                    <p className="text-xs font-semibold tracking-wide text-sui uppercase">{s.eyebrow}</p>
                    <h1 className="mt-2 text-2xl leading-tight font-bold text-balance sm:text-[1.75rem]">{s.title}</h1>
                    <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-ink-muted">{s.body}</p>
                  </div>
                </article>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
              {SLIDES.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Slide ${i + 1}: ${s.eyebrow}`}
                  onClick={() => go(i)}
                  className="grid h-6 place-items-center"
                >
                  <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === index ? "w-6 bg-navy" : "w-1.5 bg-ink/20")} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous"
                className={cn("glass grid size-12 place-items-center rounded-full transition-opacity", index === 0 && "pointer-events-none opacity-0")}
              >
                <ArrowLeft aria-hidden className="size-5" />
              </button>
              {index < last && (
                <button type="button" onClick={() => go(index + 1)} aria-label="Next" className="grid size-12 place-items-center rounded-full bg-navy text-white transition-transform active:scale-95">
                  <ArrowRight aria-hidden className="size-5" />
                </button>
              )}
            </div>
          </div>

          <div className={cn("mt-6 space-y-3 transition-all duration-300", index === last ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0")} inert={index !== last}>
            {status === "connected" ? (
              <Link href="/app" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white">
                Open SplitSense
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <ConnectButton size="lg" />
            )}
            <Link href="/demo" className="flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-sui hover:bg-white/40">
              Try the demo flat
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Float({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass absolute rounded-2xl", className)}>{children}</div>;
}

function SplitArt() {
  return (
    <div aria-hidden className="relative h-full w-full">
      <div className="hero-card absolute inset-x-8 top-8 rounded-3xl p-5 text-white">
        <p className="text-xs text-white/70">Flat balance</p>
        <div className="mt-3 flex items-center">
          {["G", "T", "A", "E"].map((n, i) => (
            <Avatar key={n} name={n} index={i} className="-ml-2 size-9 text-xs ring-2 ring-[oklch(0.32_0.12_260)] first:ml-0" />
          ))}
        </div>
        <div className="mt-5 h-2 w-3/4 rounded-full bg-white/25" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-white/15" />
      </div>
      <Float className="right-6 bottom-8 flex items-center gap-2 px-3 py-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-sui text-white">
          <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-xs font-semibold">Fewest payments</span>
      </Float>
    </div>
  );
}

function MemoryArt() {
  const rows = [
    { icon: Fuel, label: "Diesel", note: "Ada's turn" },
    { icon: CalendarClock, label: "Service charge", note: "Due in 3 days" },
    { icon: Gauge, label: "Tolu", note: "Settles in ~2 days" },
  ];
  return (
    <div aria-hidden className="w-full space-y-2.5 px-7">
      {rows.map(({ icon: Icon, label, note }, i) => (
        <div key={label} className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ marginLeft: `${i * 0.75}rem`, marginRight: `${(2 - i) * 0.75}rem` }}>
          <span className="grid size-8 place-items-center rounded-xl bg-sui-soft text-sui">
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <span className="flex-1 text-sm font-semibold">{label}</span>
          <span className="text-xs text-ink-muted">{note}</span>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-[0.6875rem] font-semibold text-white">
          <Database className="size-3" />
          Stored on Walrus
        </span>
      </div>
    </div>
  );
}

function SettleArt() {
  return (
    <div aria-hidden className="relative h-full w-full">
      <div className="glass absolute inset-x-8 top-9 rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Avatar name="E" index={3} className="size-9 text-xs" />
          <div className="mx-3 h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--sui)_0_6px,transparent_6px_10px)]" />
          <Avatar name="A" index={2} className="size-9 text-xs" />
        </div>
        <p className="mt-5 text-3xl font-bold tabular-nums">
          USDC<span className="ml-2 text-ink-muted/40">•••</span>
        </p>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-ink-muted">Network fee</span>
          <span className="font-semibold">0 SUI</span>
        </div>
      </div>
      <Float className="bottom-7 left-6 flex items-center gap-2 px-3 py-2.5">
        <BadgeCheck className="size-4 text-sui" />
        <span className="text-xs font-semibold">Confirmed through Tatum</span>
      </Float>
    </div>
  );
}

function WorkingArt() {
  return (
    <div aria-hidden className="w-full px-7">
      <div className="glass rounded-3xl p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-navy text-white">
            <Sigma className="size-4" />
          </span>
          <span className="text-sm font-semibold">Why this amount?</span>
        </div>
        <p className="mt-4 rounded-xl bg-ink/[0.04] px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-ink-muted">net = paid − owed</p>
        <div className="mt-3 space-y-2">
          {[0.8, 0.6, 0.7].map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <span className="h-2 rounded-full bg-ink/10" style={{ width: `${w * 50}%` }} />
              <span className="h-2 w-12 rounded-full bg-sui/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
