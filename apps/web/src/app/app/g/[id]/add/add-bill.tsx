"use client";

import type { Category } from "@splitsense/engine";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar, CategoryIcon } from "@/app/demo/_components/parts";
import { cn } from "@/lib/cn";
import { naira, parseNaira } from "@/lib/format";
import { refreshAll, send, useGroup, type GroupData } from "../../../_components/data";
import { Panel, useAccess } from "../../../_components/shell";

const CATEGORY_NAME: Record<Category, string> = {
  power: "Power",
  fuel: "Diesel",
  data: "Data",
  groceries: "Groceries",
  housing: "Rent & service",
  utilities: "Waste & water",
  food: "Food & drinks",
  transport: "Transport",
  tickets: "Tickets",
  stay: "Accommodation",
  other: "Other",
};

export function AddBillScreen() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccess();
  const { data } = useGroup(id, address);
  if (!data) return <div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />;
  return <AddBillForm g={data} />;
}

function AddBillForm({ g }: { g: GroupData }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(g.categories[0]!);
  const [payerId, setPayerId] = useState(g.me.id);
  const [sharing, setSharing] = useState<Set<string>>(() => new Set(g.members.map((m) => m.id)));
  const [date, setDate] = useState(g.asOf);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = (memberId: string) => Math.max(0, g.members.findIndex((m) => m.id === memberId));

  const kobo = parseNaira(amount);
  const each = kobo && sharing.size ? kobo / BigInt(sharing.size) : null;
  const toggle = (memberId: string) =>
    setSharing((s) => {
      const next = new Set(s);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!kobo) return;
    setBusy(true);
    setError(null);
    try {
      await send(`/api/groups/${g.id}/bills`, "POST", { description, amountMinor: kobo.toString(), category, payerId, participantIds: [...sharing], date });
      refreshAll();
      router.push(`/app/g/${g.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href={`/app/g/${g.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {g.name}
      </Link>

      <form onSubmit={save} className="space-y-5">
        <Panel title="Add a bill">
          <div className="space-y-5 px-3 pb-3">
            <div>
              <label htmlFor="bill-amount" className="sr-only">
                Amount in naira
              </label>
              <div className="flex items-baseline gap-2 rounded-2xl bg-white/70 px-4 py-4 ring-1 ring-ink/[0.06] focus-within:ring-sui/50">
                <span className="text-2xl font-semibold text-ink-muted">₦</span>
                <input
                  id="bill-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-ink-muted/40"
                />
              </div>
              <p className="mt-2 text-sm text-ink-muted tabular-nums">
                {amount && kobo === null ? <span className="text-owes">Enter an amount like 12,500</span> : each ? `${naira(each)} each for ${sharing.size} ${sharing.size === 1 ? "person" : "people"}` : "\u00a0"}
              </p>
            </div>

            <div>
              <label htmlFor="bill-description" className="text-sm font-semibold">
                What was it for?
              </label>
              <input
                id="bill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={60}
                placeholder={g.kind === "flat" ? "e.g. Prepaid meter top-up" : "e.g. Boat to Ilashe"}
                className="mt-2 h-13 w-full rounded-2xl bg-white/70 px-4 text-base ring-1 ring-ink/[0.06] outline-none placeholder:text-ink-muted/60 focus:ring-sui/50"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Category</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1 text-sm font-semibold ring-1 transition-colors",
                      category === c ? "bg-white/90 ring-sui/40" : "bg-white/35 ring-transparent hover:bg-white/60",
                    )}
                  >
                    <span className="scale-[0.8]">
                      <CategoryIcon category={c} />
                    </span>
                    {CATEGORY_NAME[c]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="bill-date" className="text-sm font-semibold">
                Date
              </label>
              <input
                id="bill-date"
                type="date"
                value={date}
                max={g.asOf}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-2 h-13 w-full rounded-2xl bg-white/70 px-4 text-base ring-1 ring-ink/[0.06] outline-none focus:ring-sui/50"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Who paid?">
          <div role="radiogroup" aria-label="Who paid" className="flex flex-wrap gap-2 px-3 pb-3">
            {g.members.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={payerId === m.id}
                onClick={() => setPayerId(m.id)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1 text-sm font-semibold ring-1 transition-colors",
                  payerId === m.id ? "bg-navy text-white ring-navy" : "bg-white/35 ring-transparent hover:bg-white/60",
                )}
              >
                <Avatar name={m.name} index={at(m.id)} className="size-9" />
                {m.id === g.me.id ? "You" : m.name}
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Split equally between"
          action={
            <button
              type="button"
              onClick={() => setSharing(sharing.size === g.members.length ? new Set([g.me.id]) : new Set(g.members.map((m) => m.id)))}
              className="text-sm font-semibold text-sui"
            >
              {sharing.size === g.members.length ? "Just me" : "Everyone"}
            </button>
          }
        >
          <ul role="list" className="space-y-0.5 px-1 pb-1">
            {g.members.map((m) => {
              const on = sharing.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-white/40"
                  >
                    <Avatar name={m.name} index={at(m.id)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.id === g.me.id ? `${m.name} (you)` : m.name}</span>
                    {on && each && <span className="text-sm text-ink-muted tabular-nums">{naira(each)}</span>}
                    <span aria-hidden className={cn("grid size-6 place-items-center rounded-lg ring-2", on ? "bg-sui text-white ring-sui" : "ring-ink/20")}>
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {g.members.length === 1 && (
          <p className="rounded-2xl bg-sui-soft px-4 py-3 text-sm text-pretty text-sui">
            You&apos;re the only one here so far. Invite people from the group page and their share shows up on bills you add after they join.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-owes/[0.08] px-4 py-3 text-sm text-owes">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !kobo || !description.trim() || sharing.size === 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          Add {kobo ? naira(kobo) : "bill"}
        </button>
      </form>
    </div>
  );
}
