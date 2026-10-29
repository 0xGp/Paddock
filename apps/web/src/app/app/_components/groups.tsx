"use client";

import { ChevronRight, HandCoins, House, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/app/demo/_components/parts";
import { cn } from "@/lib/cn";
import { usdc, usdcAmount } from "@/lib/format";
import type { Debt, GroupKind, GroupSummary } from "./data";

export const KIND = {
  flat: { label: "Flat", icon: House, noun: "flatmates" },
  event: { label: "Event", icon: PartyPopper, noun: "friends" },
} as const;

export function KindIcon({ kind, className }: { kind: GroupKind; className?: string }) {
  const Icon = KIND[kind].icon;
  return (
    <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", kind === "flat" ? "bg-sui-soft text-sui" : "bg-[oklch(0.93_0.06_75)] text-[oklch(0.45_0.11_60)]", className)}>
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

/** "You owe … USDC", "You're owed … USDC" or "All square", coloured to match. */
export function NetLine({ net, rate, className }: { net: bigint; rate: number; className?: string }) {
  return (
    <span className={cn("font-semibold tabular-nums", net < 0n ? "text-owes" : net > 0n ? "text-sui" : "text-ink-muted", className)}>
      {net < 0n ? `You owe ${usdc(net, rate)}` : net > 0n ? `You're owed ${usdc(net, rate)}` : "All square"}
    </span>
  );
}

export function Faces({ names, max = 4 }: { names: string[]; max?: number }) {
  return (
    <span className="flex -space-x-2">
      {names.slice(0, max).map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} index={i} className="size-7 text-[0.6875rem] ring-2 ring-white" />
      ))}
      {names.length > max && <span className="grid size-7 place-items-center rounded-full bg-ink/[0.07] text-[0.625rem] font-semibold text-ink-muted ring-2 ring-white">+{names.length - max}</span>}
    </span>
  );
}

/** Where "Pay" goes: straight to the one person you owe, or the group's list when there are several. */
export const payHref = (groupId: string, owe: Debt[]) => (owe.length === 1 ? `/app/settle?group=${groupId}&to=${owe[0]!.memberId}` : `/app/settle?group=${groupId}`);

export function PayButton({ href, label = "Pay", className }: { href: string; label?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 text-sm font-semibold text-white transition-transform active:scale-[0.97]", className)}
    >
      <HandCoins aria-hidden className="size-4" />
      {label}
    </Link>
  );
}

export function GroupRow({ g }: { g: GroupSummary }) {
  const payable = g.owe.filter((d) => d.address);
  return (
    <div className="relative flex min-h-20 items-center gap-3 rounded-[1.25rem] px-2.5 py-2.5 transition-colors hover:bg-white/50">
      <KindIcon kind={g.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Link href={`/app/g/${g.id}`} className="truncate font-semibold after:absolute after:inset-0 after:rounded-[1.25rem]">
            {g.name}
          </Link>
          {g.demo && <span className="shrink-0 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[0.625rem] font-semibold text-ink-muted uppercase">Sample</span>}
        </span>
        <span className="mt-0.5 block text-sm">
          <NetLine net={BigInt(g.net)} rate={g.rate} />
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <Faces names={g.members.map((m) => m.name)} />
          {g.members.length} {g.members.length === 1 ? "person" : "people"} · {g.billCount} {g.billCount === 1 ? "bill" : "bills"}
        </span>
      </span>
      {payable.length > 0 ? <PayButton href={payHref(g.id, payable)} className="relative z-10" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />}
    </div>
  );
}

export function DebtList({ label, rows, at, payHref }: { label: string; rows: Debt[]; at: (id: string) => number; payHref?: (d: Debt) => string }) {
  return (
    <div className="px-1 pb-1">
      <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <ul role="list" className="space-y-0.5">
        {rows.map((d) => (
          <li key={d.memberId} className="flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2">
            <Avatar name={d.name} index={at(d.memberId)} />
            <p className="min-w-0 flex-1 truncate font-semibold">{d.name}</p>
            <p className="font-bold tabular-nums">{usdcAmount(BigInt(d.microUsdc))} USDC</p>
            {payHref && (
              <Link
                href={payHref(d)}
                aria-disabled={!d.address}
                className={cn(
                  "ml-1 inline-flex h-9 items-center rounded-full bg-navy px-4 text-sm font-semibold text-white transition-transform active:scale-[0.97]",
                  !d.address && "pointer-events-none opacity-40",
                )}
              >
                Pay
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
