"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronDown, Database, ExternalLink, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { naira, shortAddress, shortId, stamp, suiscanAccount, suiscanCheckpoint, suiscanTx, usdcAmount, walruscanBlob } from "@/lib/format";
import type { PaymentItem } from "./data";

export function ReceiptChip({ receipt }: { receipt: PaymentItem["receipt"] }) {
  if (receipt?.status === "stored")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal/40 px-2 py-0.5 text-[0.6875rem] font-semibold text-teal-ink">
        <Database aria-hidden className="size-3" />
        On Walrus
      </span>
    );
  if (receipt?.status === "failed") return <span className="rounded-full bg-owes/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-owes">Receipt failed</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-muted">
      <LoaderCircle aria-hidden className="size-3 animate-spin" />
      Writing receipt
    </span>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
const clockTime = (iso: string) => timeFormat.format(new Date(iso));

const linkClass = "inline-flex items-center gap-1 font-mono text-[0.8125rem] text-sui underline-offset-2 hover:underline";

/** One confirmed settlement; opens to the chain and Walrus evidence. */
export function PaymentRow({
  p,
  me,
  group,
  expandable = true,
  dated = true,
}: {
  p: PaymentItem;
  me: string | null;
  group?: string;
  expandable?: boolean;
  dated?: boolean;
}) {
  const outgoing = p.from === me;
  const incoming = p.to === me;
  const title = outgoing ? `To ${p.toName}` : incoming ? `From ${p.fromName}` : `${p.fromName} → ${p.toName}`;

  const summary = (
    <>
      <span
        aria-hidden
        className={cn("grid size-10 shrink-0 place-items-center rounded-full", outgoing ? "bg-owes/10 text-owes" : incoming ? "bg-sui-soft text-sui" : "bg-ink/[0.06] text-ink-muted")}
      >
        {incoming ? <ArrowDownLeft className="size-[1.125rem]" strokeWidth={2.25} /> : <ArrowUpRight className="size-[1.125rem]" strokeWidth={2.25} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs whitespace-nowrap text-ink-muted">
          {group && <span className="max-w-32 truncate font-medium text-ink">{group}</span>}
          {dated ? stamp(p.settledAt) : clockTime(p.settledAt)}
          {p.receipt !== undefined && <ReceiptChip receipt={p.receipt} />}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block font-bold tabular-nums", incoming && "text-sui")}>
          {outgoing ? "−" : incoming ? "+" : ""}
          {usdcAmount(BigInt(p.microUsdc))}
        </span>
        <span className="block text-xs text-ink-muted tabular-nums">USDC · {naira(BigInt(p.amountMinor))}</span>
      </span>
    </>
  );

  if (!expandable) return <div className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3">{summary}</div>;

  return (
    <details className="explain group rounded-2xl transition-colors open:bg-white/50">
      <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 hover:bg-white/40">
        {summary}
        <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="explain-panel px-4 pb-4">
        <dl className="divide-y divide-line">
          <Detail label="Transaction">
            <a href={suiscanTx(p.digest)} target="_blank" rel="noreferrer" className={linkClass}>
              {shortId(p.digest)}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          </Detail>
          {p.checkpoint !== null && (
            <Detail label="Checkpoint">
              <a href={suiscanCheckpoint(p.checkpoint)} target="_blank" rel="noreferrer" className={linkClass}>
                {p.checkpoint.toLocaleString("en-US")}
              </a>
            </Detail>
          )}
          <Detail label="From">
            <a href={suiscanAccount(p.fromAddress)} target="_blank" rel="noreferrer" className={linkClass}>
              {p.fromName} · {shortAddress(p.fromAddress)}
            </a>
          </Detail>
          <Detail label="To">
            <a href={suiscanAccount(p.toAddress)} target="_blank" rel="noreferrer" className={linkClass}>
              {p.toName} · {shortAddress(p.toAddress)}
            </a>
          </Detail>
          <Detail label="Exact amount">{usdcAmount(BigInt(p.microUsdc), true)} USDC</Detail>
          <Detail label="Receipt">
            {p.receipt?.blobId ? (
              <a href={walruscanBlob(p.receipt.blobId)} target="_blank" rel="noreferrer" className={linkClass}>
                {shortId(p.receipt.blobId)}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            ) : (
              <span className="text-ink-muted">{p.receipt ? "Being written to Walrus" : "Kept in SplitSense"}</span>
            )}
          </Detail>
        </dl>
        <p className="mt-3 text-xs text-pretty text-ink-muted">
          Confirmed through Tatum{p.confirmMs !== null ? ` in ${(p.confirmMs / 1000).toFixed(1)} s` : ""}: the payer lost and the payee gained exactly this amount.
        </p>
      </div>
    </details>
  );
}
