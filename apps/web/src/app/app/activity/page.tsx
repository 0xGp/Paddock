"use client";

import { History, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { usdcAmount } from "@/lib/format";
import { useActivity, type ActivityItem } from "../_components/data";
import { PaymentRow } from "../_components/payment";
import { EmptyState, Panel, useAccess } from "../_components/shell";

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export default function ActivityScreen() {
  const { address } = useAccess();
  const { data } = useActivity(address);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  if (!data) return <div className="glass mx-auto h-96 max-w-2xl animate-pulse rounded-[1.75rem]" />;
  if (data.groups.length === 0)
    return (
      <Panel className="mx-auto max-w-2xl">
        <EmptyState icon={<Users className="size-6" />} title="No groups, no activity" body="Payments show up here once you're in a flat or an event.">
          <Link href="/app/new" className="inline-flex h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white">
            Create a group
          </Link>
        </EmptyState>
      </Panel>
    );

  const shown = data.payments.filter((p) => filter === "all" || p.from === p.me || p.to === p.me);
  const total = data.payments.reduce((s, p) => s + BigInt(p.microUsdc), 0n);
  const remembered = data.payments.filter((p) => p.memory);
  const stored = remembered.filter((p) => p.receipt?.status === "stored").length;
  const several = data.groups.length > 1;
  const days = new Map<string, ActivityItem[]>();
  for (const p of shown) days.set(dayKey(p.settledAt), [...(days.get(dayKey(p.settledAt)) ?? []), p]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="glass grid grid-cols-3 divide-x divide-line rounded-[1.75rem] py-4">
        {[
          { label: "Payments", value: String(data.payments.length) },
          { label: "Settled", value: `${usdcAmount(total)} USDC` },
          { label: "Receipts on Walrus", value: `${stored} of ${remembered.length}` },
        ].map((s) => (
          <div key={s.label} className="px-4 text-center">
            <p className="text-lg font-bold tabular-nums sm:text-xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </section>

      <Panel
        title={several ? "All your groups" : `${data.groups[0]!.name} activity`}
        action={
          <div role="tablist" aria-label="Filter" className="flex rounded-full bg-ink/[0.05] p-0.5">
            {(["all", "mine"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn("h-8 rounded-full px-3.5 text-xs font-semibold transition-colors", filter === f ? "bg-white text-ink shadow-sm" : "text-ink-muted")}
              >
                {f === "all" ? "Everyone" : "Yours"}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 && (
          <EmptyState
            icon={<History className="size-6" />}
            title={filter === "mine" ? "Nothing from you yet" : "No payments yet"}
            body="Settlements made on Sui appear here, each with its transaction and its receipt."
          >
            <Link href="/app/settle" className="inline-flex h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white">
              Settle up
            </Link>
          </EmptyState>
        )}
        {[...days].map(([day, items]) => (
          <div key={day} className="pb-1">
            <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{dayFormat.format(new Date(`${day}T12:00:00+01:00`))}</p>
            <div className="space-y-0.5">
              {items.map((p) => (
                <PaymentRow key={p.digest} p={p} me={p.me} group={several ? p.groupName : undefined} dated={false} />
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <p className="text-center text-xs text-pretty text-ink-muted">
        Every payment here was read back through Tatum before it counted. Tap one for its Suiscan and receipt links.
      </p>
    </div>
  );
}
