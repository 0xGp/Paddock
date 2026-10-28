"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { refreshAll, send, type GroupKind } from "../_components/data";
import { KIND, KindIcon } from "../_components/groups";
import { Panel } from "../_components/shell";

const COPY = {
  flat: { blurb: "Shared bills at home that keep coming: power, diesel, data, groceries.", name: "e.g. Flat 3B", place: "Area, e.g. Lekki Phase 1" },
  event: { blurb: "A trip, a party or a weekend away. Split it, settle it, done.", name: "e.g. Ilashe beach day", place: "Where or when, e.g. Ilashe, 14 Dec" },
} as const;

const field = "h-13 w-full rounded-2xl bg-white/70 px-4 text-base ring-1 ring-ink/[0.06] outline-none placeholder:text-ink-muted/60 focus:ring-sui/50";

export default function NewGroupScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<GroupKind>("flat");
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [rate, setRate] = useState("1500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rateNumber = Number(rate.replace(/[,\s]/g, ""));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { id } = await send<{ id: string }>("/api/groups", "POST", { name, kind, place, rate: rateNumber });
      refreshAll();
      router.push(`/app/g/${id}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/app" className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Home
      </Link>

      <Panel title="New group">
        <form onSubmit={create} className="space-y-5 px-3 pb-3">
          <fieldset>
            <legend className="text-sm font-semibold">What is it for?</legend>
            <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2">
              {(["flat", "event"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn("rounded-2xl p-3 text-left ring-1 transition-all", kind === k ? "bg-white/85 ring-sui/40" : "bg-white/30 ring-transparent hover:bg-white/50")}
                >
                  <KindIcon kind={k} className="size-10" />
                  <span className="mt-2 block font-semibold">{KIND[k].label}</span>
                  <span className="mt-0.5 block text-xs text-pretty text-ink-muted">{COPY[k].blurb}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="group-name" className="text-sm font-semibold">
              Name
            </label>
            <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={48} placeholder={COPY[kind].name} className={cn(field, "mt-2 font-semibold")} />
          </div>

          <div>
            <label htmlFor="group-place" className="text-sm font-semibold">
              {kind === "flat" ? "Area" : "Where or when"} <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input id="group-place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder={COPY[kind].place} className={cn(field, "mt-2")} />
          </div>

          <div>
            <label htmlFor="group-rate" className="text-sm font-semibold">
              Naira per USDC
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white/70 px-4 ring-1 ring-ink/[0.06] focus-within:ring-sui/50">
              <span className="text-ink-muted">₦</span>
              <input id="group-rate" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} aria-describedby="rate-help" className="h-13 w-full bg-transparent font-semibold tabular-nums outline-none" />
              <span className="shrink-0 text-sm text-ink-muted">= 1 USDC</span>
            </div>
            <p id="rate-help" className="mt-1.5 text-xs text-ink-muted">
              Bills are in naira. When someone settles, this rate turns what they owe into USDC.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-owes/[0.08] px-4 py-3 text-sm text-owes">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !name.trim() || !Number.isInteger(rateNumber) || rateNumber < 100}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            Create {kind === "flat" ? "flat" : "event"}
          </button>
          <p className="text-center text-xs text-ink-muted">Next, you&apos;ll get a link to invite your {KIND[kind].noun}.</p>
        </form>
      </Panel>
    </div>
  );
}
