"use client";

import { ArrowLeft, Check, Copy, HandCoins, History, Lightbulb, Plus, ReceiptText, RefreshCw, Share2, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, CategoryIcon } from "@/app/demo/_components/parts";
import { cn } from "@/lib/cn";
import { naira, shortAddress, shortDate } from "@/lib/format";
import { refreshAll, send, useGroup, type Bill, type GroupData } from "../../_components/data";
import { DebtList, Faces, KIND, KindIcon, PayButton, payHref } from "../../_components/groups";
import { PaymentRow } from "../../_components/payment";
import { EmptyState, Panel, useAccess } from "../../_components/shell";

export function GroupScreen() {
  const { id } = useParams<{ id: string }>();
  const fresh = useSearchParams().get("new") === "1";
  const { address } = useAccess();
  const { data, error } = useGroup(id, address);

  if (!data && error)
    return (
      <Panel className="mx-auto max-w-xl">
        <EmptyState icon={<History className="size-6" />} title="Can't open this group" body={error}>
          <Link href="/app" className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
            Back home
          </Link>
        </EmptyState>
      </Panel>
    );
  if (!data) return <div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />;

  const at = (memberId: string) => Math.max(0, data.members.findIndex((m) => m.id === memberId));
  return (
    <div className="space-y-4">
      <Link href="/app" className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Home
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6">
        <div className="space-y-5">
          <Header g={data} />
          <Balance g={data} at={at} />
          <Bills g={data} />
        </div>
        <div className="space-y-5">
          {data.demo ? <DemoNote /> : <Invite g={data} highlight={fresh} at={at} />}
          {(data.turns.length > 0 || data.upcoming.length > 0) && <Spotted g={data} />}
          {data.payments.length > 0 && (
            <Panel title="Payments">
              <div className="space-y-0.5">
                {data.payments.map((p) => (
                  <PaymentRow key={p.digest} p={p} me={data.me.id} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ g }: { g: GroupData }) {
  const payable = g.owe.filter((d) => d.address);
  return (
    <section className="hero-card rounded-[2rem] p-6 text-white">
      <div className="flex items-start gap-3">
        <KindIcon kind={g.kind} className="bg-white/15 text-white ring-1 ring-white/25" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-white/65 uppercase">
            {KIND[g.kind].label}
            {g.demo && " · Sample"}
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-bold">{g.name}</h1>
          {g.place && <p className="truncate text-sm text-white/70">{g.place}</p>}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-white/75">
          <Faces names={g.members.map((m) => m.name)} max={5} />
          {g.members.length} {g.members.length === 1 ? "person" : "people"}
        </span>
        <span className="text-sm text-white/75 tabular-nums">
          {naira(BigInt(g.spentMinor))} over {g.billCount} {g.billCount === 1 ? "bill" : "bills"}
        </span>
      </div>
      {payable.length > 0 && (
        <Link
          href={payHref(g.id, payable)}
          className="mt-5 flex h-14 items-center justify-center gap-2 rounded-full bg-white text-base font-semibold text-navy shadow-[0_10px_30px_-12px_oklch(0.2_0.08_264/0.7)] transition-transform active:scale-[0.97]"
        >
          <HandCoins aria-hidden className="size-5" />
          Pay {naira(-BigInt(g.net))}
          {payable.length === 1 && <span className="font-medium text-ink-muted">to {payable[0]!.name}</span>}
        </Link>
      )}
      {!g.demo && (
        <div className={cn("grid grid-cols-2 gap-3", payable.length > 0 ? "mt-3" : "mt-5")}>
          <Link
            href={`/app/g/${g.id}/add`}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]",
              payable.length > 0 ? "border border-white/25 bg-white/10 backdrop-blur-md" : "bg-white text-navy",
            )}
          >
            <Plus aria-hidden className="size-4" />
            Add a bill
          </Link>
          <a
            href="#invite"
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 text-sm font-semibold backdrop-blur-md transition-transform active:scale-[0.97]"
          >
            <UserPlus aria-hidden className="size-4" />
            Invite
          </a>
        </div>
      )}
    </section>
  );
}

function Balance({ g, at }: { g: GroupData; at: (id: string) => number }) {
  const net = BigInt(g.net);
  return (
    <Panel>
      <div className="px-3 pt-4 pb-3">
        <p className="text-sm text-ink-muted">{net < 0n ? "You owe" : net > 0n ? "You're owed" : "Your balance"}</p>
        <p className={cn("mt-1 text-3xl font-bold tabular-nums", net < 0n ? "text-owes" : net > 0n ? "text-sui" : "text-ink")}>{net === 0n ? "All square" : naira(net)}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {g.billCount === 0
            ? "Add the first bill and SplitSense works out who owes whom."
            : `At ₦${g.rate.toLocaleString("en-NG")} per USDC, after payments already made on Sui.`}
        </p>
      </div>
      {g.owe.length > 0 && <DebtList label="You pay" rows={g.owe} at={at} payHref={(d) => `/app/settle?group=${g.id}&to=${d.memberId}`} />}
      {g.owed.length > 0 && <DebtList label="Pays you" rows={g.owed} at={at} />}
    </Panel>
  );
}

function Bills({ g }: { g: GroupData }) {
  return (
    <Panel
      title="Bills"
      action={
        !g.demo &&
        g.bills.length > 0 && (
          <Link href={`/app/g/${g.id}/add`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy px-3.5 text-sm font-semibold text-white">
            <Plus aria-hidden className="size-4" />
            Add
          </Link>
        )
      }
    >
      {g.bills.length === 0 ? (
        <EmptyState icon={<ReceiptText className="size-6" />} title="No bills yet" body="Whoever pays for something adds it here, with who it's shared between.">
          <Link href={`/app/g/${g.id}/add`} className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white">
            <Plus aria-hidden className="size-4" />
            Add the first bill
          </Link>
        </EmptyState>
      ) : (
        <ul role="list" className="space-y-0.5">
          {g.bills.map((b) => (
            <BillRow key={b.id} b={b} groupId={g.id} me={g.me.id} />
          ))}
        </ul>
      )}
      {g.billCount > g.bills.length && <p className="px-3 pt-1 pb-3 text-center text-xs text-ink-muted">Showing the latest {g.bills.length} of {g.billCount} bills.</p>}
    </Panel>
  );
}

function BillRow({ b, groupId, me }: { b: Bill; groupId: string; me: string }) {
  const [busy, setBusy] = useState(false);
  const share = BigInt(b.shareMinor);
  const remove = async () => {
    if (!confirm(`Remove "${b.description}"? Balances will be worked out again without it.`)) return;
    setBusy(true);
    try {
      await send(`/api/groups/${groupId}/bills/${b.id}`, "DELETE");
      refreshAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <li className={cn("flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2", busy && "opacity-50")}>
      <CategoryIcon category={b.category} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{b.description}</p>
        <p className="truncate text-xs text-ink-muted">
          {b.payer.id === me ? "You" : b.payer.name} paid · {shortDate(b.date)} · split {b.people} {b.people === 1 ? "way" : "ways"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold tabular-nums">{naira(BigInt(b.amountMinor))}</p>
        <p className="text-xs text-ink-muted tabular-nums">{share > 0n ? `Yours ${naira(share)}` : "Not yours"}</p>
      </div>
      {b.mine && (
        <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${b.description}`} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-owes/[0.08] hover:text-owes">
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
    </li>
  );
}

function Invite({ g, highlight, at }: { g: GroupData; highlight: boolean; at: (id: string) => number }) {
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const url = g.invite && typeof window !== "undefined" ? `${window.location.origin}/join/${g.invite}` : "";
  const noun = KIND[g.kind].noun;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const share = () => navigator.share?.({ title: g.name, text: `Join ${g.name} on SplitSense so we can split bills and settle up.`, url }).catch(() => null);
  const rotate = async () => {
    if (!confirm("Make a new link? The current one will stop working.")) return;
    setRotating(true);
    try {
      await send(`/api/groups/${g.id}/invite`, "POST");
      refreshAll();
    } finally {
      setRotating(false);
    }
  };

  return (
    <section id="invite" className={cn("glass scroll-mt-24 rounded-[1.75rem] p-2", highlight && "ring-2 ring-sui/40")}>
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-base font-bold">{highlight ? `Your ${KIND[g.kind].label.toLowerCase()} is ready. Invite your ${noun}` : "People"}</h2>
        <p className="mt-0.5 text-sm text-pretty text-ink-muted">Anyone with this link can join after connecting their wallet.</p>
      </div>
      <div className="mx-1 rounded-2xl bg-white/70 p-3 ring-1 ring-ink/[0.06]">
        <p className="truncate font-mono text-[0.8125rem]">{url || "…"}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copy} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-navy text-sm font-semibold text-white">
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" onClick={share} className="glass inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold">
              <Share2 aria-hidden className="size-4" />
              Share
            </button>
          )}
          <button type="button" onClick={rotate} disabled={rotating} aria-label="Make a new invite link" className="glass grid size-10 shrink-0 place-items-center rounded-full">
            <RefreshCw aria-hidden className={cn("size-4", rotating && "animate-spin")} />
          </button>
        </div>
      </div>
      <ul role="list" className="mt-2 space-y-0.5">
        {g.members.map((m) => {
          const net = BigInt(m.net);
          return (
            <li key={m.id} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-1.5">
              <Avatar name={m.name} index={at(m.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.name}
                  {m.id === g.me.id && <span className="ml-1.5 text-xs font-medium text-ink-muted">you</span>}
                </p>
                {m.address && <p className="font-mono text-[0.6875rem] text-ink-muted">{shortAddress(m.address)}</p>}
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", net < 0n ? "text-owes" : net > 0n ? "text-sui" : "text-ink-muted")}>
                {net < 0n ? `owes ${naira(net)}` : net > 0n ? `owed ${naira(net)}` : "square"}
              </p>
              {g.owe.some((d) => d.memberId === m.id && d.address) && <PayButton href={`/app/settle?group=${g.id}&to=${m.id}`} className="ml-1" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Spotted({ g }: { g: GroupData }) {
  const items = [...g.turns.map((t) => ({ key: `turn-${t.category}`, category: t.category, text: t.summary })), ...g.upcoming.map((u) => ({ key: `bill-${u.category}`, category: u.category, text: u.summary }))];
  return (
    <Panel title="Spotted in your bills">
      <ul role="list" className="space-y-0.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-3 rounded-2xl px-2 py-2">
            <CategoryIcon category={i.category} />
            <p className="pt-0.5 text-sm text-pretty">{i.text}</p>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 px-3 pt-1 pb-3 text-xs text-ink-muted">
        <Lightbulb aria-hidden className="size-3.5" />
        Worked out from the bills above, the same way as the demo flat.
      </p>
    </Panel>
  );
}

function DemoNote() {
  return (
    <Panel>
      <EmptyState icon={<History className="size-6" />} title="This is the sample flat" body="Its bills are read-only. Everything it has learned is stored on Walrus, with the working behind each number.">
        <Link href="/demo" className="inline-flex h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white">
          See what it remembers
        </Link>
      </EmptyState>
    </Panel>
  );
}
