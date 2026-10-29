import type { Category } from "@splitsense/engine";
import type { Change } from "@splitsense/memory";
import { ArrowUpRight, CircleOff, DatabaseZap, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { shortDate, shortId, stamp, usdc, usdcText, walruscanBlob } from "@/lib/format";
import type { DemoMemory, MemoryRef, TimelineItem } from "@/server/memory";
import { WithMemory } from "./memory-switch";
import { Avatar, CategoryIcon, Chip } from "./parts";

const KIND: Record<string, string> = { pattern_snapshot: "pattern", member_habit: "habit", settlement_receipt: "receipt" };

export function MemoryLink({ memory }: { memory: MemoryRef }) {
  return (
    <p>
      Remembered on Walrus as {KIND[memory.kind] ?? memory.kind} #{memory.seq}
      {memory.kind !== "settlement_receipt" && <>, learned as of {shortDate(memory.asOf)}</>}
      {memory.createdAt && <>, saved {stamp(memory.createdAt)}</>}.{" "}
      {memory.blobId && (
        <a
          href={walruscanBlob(memory.blobId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-mono font-medium text-sui underline-offset-2 hover:underline"
        >
          {shortId(memory.blobId)}
          <ArrowUpRight aria-hidden className="size-3" strokeWidth={2.5} />
          <span className="sr-only">(Walrus blob, opens Walruscan)</span>
        </a>
      )}
    </p>
  );
}

/** What a plain splitter shows in place of a learned row. */
export function MemoryOffRow({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex min-h-16 items-center gap-3 rounded-2xl px-3 py-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.05] text-ink-muted">
        <CircleOff className="size-[1.125rem]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink-muted">{title}</p>
        <p className="text-sm text-pretty text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

export function MemoryCard({ memory, className }: { memory: DemoMemory; className?: string }) {
  const { ledger } = memory;
  const seconds = memory.recallMs === null ? null : (memory.recallMs / 1000).toFixed(1);
  return (
    <section id="memory-section" aria-labelledby="memory" className={cn("glass scroll-mt-20 rounded-[1.75rem] p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="memory" className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden className="grid size-8 place-items-center rounded-xl bg-navy text-sui-bright">
            <DatabaseZap className="size-4" strokeWidth={2} />
          </span>
          Memory
        </h2>
        <WithMemory off={<Chip>Off</Chip>}>
          {memory.state === "live" ? <Chip tone="teal">Walrus Mainnet</Chip> : memory.state === "cached" ? <Chip>Cached</Chip> : <Chip>Not loaded</Chip>}
        </WithMemory>
      </div>

      <WithMemory
        off={
          <p className="mt-4 text-sm text-pretty text-ink-muted">
            Memory is off, so this is any bill splitter: balances and payments from the ledger, nothing learned. Turn it back on to see what Paddock
            remembered about this flat.
          </p>
        }
      >
        {memory.state === "missing" ? (
          <p className="mt-4 text-sm text-pretty text-ink-muted">Nothing recalled from Walrus yet. The first visit starts a recall; check back in a minute.</p>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium tabular-nums">
              Recalled from Walrus · {memory.verified} memories · {memory.recallMs?.toLocaleString("en-NG")} ms
            </p>
            <p className="mt-0.5 text-xs text-pretty text-ink-muted tabular-nums">
              {memory.recalledAt && <>Last recall {stamp(memory.recalledAt)} WAT, {seconds}s round trip. </>}
              {memory.relayerCount !== null && <>{memory.relayerCount} memories stored for this flat. </>}
              Every one re-checked against its hash{memory.rejected > 0 ? `; ${memory.rejected} rejected` : ""}.
            </p>
            {memory.state === "cached" && memory.attemptedAt && (
              <p className="mt-2 text-xs text-pretty text-owes">Using cached memory: Walrus didn’t answer at {stamp(memory.attemptedAt)}.</p>
            )}
            {ledger && (
              <div className={cn("mt-4 flex items-start gap-3 rounded-2xl p-3", ledger.ok ? "bg-teal/25" : "bg-owes/10")}>
                {ledger.ok ? (
                  <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-teal-ink" strokeWidth={2} />
                ) : (
                  <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-owes" strokeWidth={2} />
                )}
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold tabular-nums", ledger.ok ? "text-teal-ink" : "text-owes")}>
                    Ledger verified up to entry {ledger.verifiedEntries}
                    {ledger.verifiedEntries < ledger.totalEntries && ` of ${ledger.totalEntries}`}
                  </p>
                  <p className="text-xs text-pretty text-ink-muted">
                    Rebuilt from {ledger.checkpoints} checkpoints on Walrus and matched hash for hash{ledger.reason ? `. ${ledger.reason}` : ""}.
                  </p>
                </div>
              </div>
            )}
            <p className="mt-3 truncate font-mono text-[0.6875rem] text-ink-muted">namespace {memory.namespace}</p>
          </>
        )}
      </WithMemory>
    </section>
  );
}

const SPEED: Record<string, string> = { fast: "Fast", steady: "Steady", slow: "Slow" };
const FIELD: Record<string, string> = {
  nextPayerId: "Next",
  usualPayerId: "Usual payer",
  usualCount: "Times covered",
  totalCount: "Times bought",
  nextExpectedDate: "Due",
  expectedAmountMinor: "Usually",
  cadence: "Rhythm",
  label: "Speed",
  medianDelay: "Typical delay",
  score: "Score",
};

function ChangeChip({ change, name, rate }: { change: Change; name: (id: string) => string; rate: number }) {
  const fmt = (v: unknown) => {
    if (v === undefined || v === null) return "–";
    switch (change.field) {
      case "nextPayerId":
      case "usualPayerId":
        return name(String(v));
      case "nextExpectedDate":
        return shortDate(String(v));
      case "expectedAmountMinor":
        return usdc(BigInt(String(v)), rate);
      case "label":
        return SPEED[String(v)] ?? String(v);
      case "medianDelay":
        return `~${v} days`;
      default:
        return String(v);
    }
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs ring-1 ring-line tabular-nums">
      <span className="text-ink-muted">{FIELD[change.field] ?? change.field}</span>
      <span className="text-ink-muted line-through decoration-ink/30">{fmt(change.from)}</span>
      <span aria-hidden className="text-ink-muted">→</span>
      <span className="sr-only">to</span>
      <span className="font-semibold">{fmt(change.to)}</span>
    </span>
  );
}

const STATUS: Record<TimelineItem["status"], { label: string; tone: "teal" | "muted" }> = {
  new: { label: "New", tone: "teal" },
  changed: { label: "Changed", tone: "muted" },
  retired: { label: "Stopped", tone: "muted" },
};

export function Timeline({ memory, members, rate }: { memory: DemoMemory; members: { id: string; displayName: string }[]; rate: number }) {
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? id;
  const at = (id: string) => Math.max(0, members.findIndex((m) => m.id === id));
  const total = memory.timeline.reduce((n, d) => n + d.items.length, 0);
  return (
    <section id="timeline-section" aria-labelledby="timeline" className="glass mt-6 scroll-mt-20 rounded-[1.75rem] p-2">
      <div className="px-3 pt-3 pb-1">
        <h2 id="timeline" className="text-base font-bold text-balance">
          How it learned
        </h2>
        <p className="mt-0.5 text-sm text-pretty text-ink-muted">
          <WithMemory off="Memory is off. Nothing learned is shown.">
            {total > 0 ? `${total} things it noticed or revised, read back from Walrus in order. Tap a date.` : "Nothing recalled yet."}
          </WithMemory>
        </p>
      </div>
      <WithMemory off={null}>
        <ol className="space-y-1 px-1 pb-1">
          {memory.timeline.map((day, i) => (
            <li key={day.asOf}>
              <details className="explain group" open={i === memory.timeline.length - 1}>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors duration-150 select-none hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sui">
                  <span className="font-semibold">{shortDate(day.asOf)}</span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {day.items.filter((t) => t.status === "new").length} new · {day.items.filter((t) => t.status !== "new").length} revised
                  </span>
                </summary>
                <ul role="list" className="explain-panel space-y-0.5 pb-2">
                  {day.items.map((t) => {
                    const category = t.memory.subject.split(".")[1] as Category | undefined;
                    return (
                      <li key={t.memory.hash} className="flex items-start gap-3 rounded-2xl px-3 py-2.5">
                        {t.ruleId === "R5" ? <Avatar name={name(t.memory.subject)} index={at(t.memory.subject)} /> : <CategoryIcon category={category ?? "other"} />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-pretty">
                            <span className="mr-1.5 align-[1px]">
                              <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
                            </span>
                            {usdcText(t.status === "retired" ? t.summary.replace(/^No longer holds as of [\d-]+: /, "") : t.summary, rate)}
                          </p>
                          {t.changes.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {t.changes.map((c) => (
                                <ChangeChip key={c.field} change={c} name={name} rate={rate} />
                              ))}
                            </div>
                          )}
                        </div>
                        {t.memory.blobId && (
                          <a
                            href={walruscanBlob(t.memory.blobId)}
                            target="_blank"
                            rel="noreferrer"
                            className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-white/60 hover:text-sui"
                          >
                            <ArrowUpRight aria-hidden className="size-4" strokeWidth={2} />
                            <span className="sr-only">Open this memory’s Walrus blob {shortId(t.memory.blobId)} on Walruscan</span>
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      </WithMemory>
    </section>
  );
}
