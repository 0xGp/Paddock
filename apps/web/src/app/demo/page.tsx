import type { Cadence, Category } from "@splitsense/engine";
import { ArrowRight, CalendarClock, DatabaseZap, HandCoins, House } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dueLabel, fullDate, naira, shortDate, usdc } from "@/lib/format";
import { getDemoFlat } from "@/server/demo";
import { getDemoMemory } from "@/server/memory";
import { MemoryCard, MemoryOffRow, Timeline } from "./_components/memory";
import { MemoryProvider, MemorySwitch, RefreshOnVisit, WithMemory } from "./_components/memory-switch";
import { Avatar, Brand, CategoryIcon, Chip, Meter, Row, Section } from "./_components/parts";
import { ReceiptRow } from "./_components/receipt";
import { ExplainRow } from "./_components/why";

export const metadata: Metadata = {
  title: "Flat 3B demo · SplitSense",
  description: "A sample Lagos flat: who owes whom, whose turn it is, and what's due, with the working behind every number.",
};

const CATEGORY_NAME: Record<Category, string> = {
  fuel: "Diesel",
  power: "Power",
  data: "Data",
  groceries: "Groceries",
  housing: "Service charge",
  utilities: "LAWMA",
  food: "Food",
  transport: "Transport",
  tickets: "Tickets",
  stay: "Accommodation",
  other: "Other",
};

const CADENCE: Record<Cadence, string> = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };
const SPEED = { fast: "Fast", steady: "Steady", slow: "Slow" } as const;
const WORD = ["No", "One", "Two", "Three", "Four"];

const NAV = [
  { href: "#top", label: "Home", icon: House },
  { href: "#settle-section", label: "Settle", icon: HandCoins },
  { href: "#upcoming-section", label: "Bills", icon: CalendarClock },
  { href: "#memory-section", label: "Memory", icon: DatabaseZap },
];

export default async function DemoPage() {
  const [{ group, members, entryCount, recent, view }, memory] = await Promise.all([getDemoFlat(), getDemoMemory()]);
  const learnedNote = memory.learnedAsOf ? `Remembered on Walrus, learned as of ${shortDate(memory.learnedAsOf)}.` : "Remembered on Walrus.";
  const index = new Map(members.map((m, i) => [m.id, i]));
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? id;
  const at = (id: string) => index.get(id) ?? 0;
  const openTotal = view.balances.reduce((s, b) => (b.netMinor > 0n ? s + b.netMinor : s), 0n);
  const payments = view.transfers.length;

  return (
    <MemoryProvider>
    <div id="top" className="min-h-dvh">
      <div aria-hidden className="backdrop" />
      <RefreshOnVisit />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <Brand tag="Demo flat" />
        <MemorySwitch />
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:pb-16">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6">
          <div className="contents lg:block lg:space-y-6">
            <section aria-labelledby="open-total" className="hero-card order-1 rounded-[2rem] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{group.name}</p>
                  <p className="truncate text-xs text-white/70">{group.address}</p>
                </div>
                <div className="flex -space-x-2" aria-label={`${members.length} flatmates: ${members.map((m) => m.displayName).join(", ")}`}>
                  {members.map((m, i) => (
                    <Avatar key={m.id} name={m.displayName} index={i} className="size-8 text-xs ring-2 ring-[oklch(0.3_0.1_262)]" />
                  ))}
                </div>
              </div>
              <h2 id="open-total" className="mt-8 text-sm text-white/75">
                Still open
              </h2>
              <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">{naira(openTotal)}</p>
              <p className="mt-2 text-sm text-pretty text-white/75">
                {openTotal > 0n
                  ? `${WORD[payments] ?? payments} ${payments === 1 ? "payment settles" : "payments settle"} everyone.`
                  : "Everyone is square."}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <a
                  href="#settle-section"
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-navy transition-transform duration-150 active:scale-[0.97]"
                >
                  <HandCoins aria-hidden className="size-4" strokeWidth={2} />
                  Settle up
                </a>
                <a
                  href="#upcoming-section"
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 text-sm font-semibold backdrop-blur-md transition-transform duration-150 active:scale-[0.97]"
                >
                  <CalendarClock aria-hidden className="size-4" strokeWidth={2} />
                  Bills due
                </a>
              </div>
            </section>

            <MemoryCard memory={memory} className="order-2" />

            <Section
              id="settle"
              className="order-3"
              title="Settle up"
              note={`Group rate ₦${group.rateNgnPerUsdc.toLocaleString("en-NG")} = 1 USDC. Tap to see why.`}
            >
              {view.transfers.map((t) => (
                <ExplainRow key={`${t.from}-${t.to}`} explanation={t.explanation}>
                  <Avatar name={name(t.from)} index={at(t.from)} className="sm:hidden" />
                  <div className="hidden shrink-0 items-center sm:flex">
                    <Avatar name={name(t.from)} index={at(t.from)} />
                    <span aria-hidden className="-mx-1 z-10 grid size-5 place-items-center rounded-full bg-white shadow-sm">
                      <ArrowRight className="size-3 text-ink" strokeWidth={2.5} />
                    </span>
                    <Avatar name={name(t.to)} index={at(t.to)} />
                  </div>
                  <p className="min-w-0 flex-1 truncate font-medium">
                    {name(t.from)} <span className="text-ink-muted">pays</span> {name(t.to)}
                  </p>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{naira(t.amountMinor)}</p>
                    <p className="text-xs text-ink-muted tabular-nums">{usdc(t.amountMinor, group.rateNgnPerUsdc)}</p>
                  </div>
                </ExplainRow>
              ))}
            </Section>

            {memory.receipts.length > 0 && (
              <Section id="paid" className="order-3" title="Paid on Sui" note="Real USDC payments on Sui Mainnet, read back from their Walrus receipts. Tap one for the transaction.">
                {memory.receipts.map((r) => (
                  <ReceiptRow key={r.digest} receipt={r} name={name} at={at} />
                ))}
              </Section>
            )}

            <Section id="balances" className="order-4" title="Balances" note="Unsettled shares, minus what's already been paid on Sui.">
              {view.balances.map((b) => (
                <Row key={b.memberId}>
                  <Avatar name={name(b.memberId)} index={at(b.memberId)} />
                  <p className="min-w-0 flex-1 font-medium">{name(b.memberId)}</p>
                  {b.netMinor === 0n ? (
                    <Chip>All square</Chip>
                  ) : (
                    <p className="text-right">
                      <span className={b.netMinor > 0n ? "font-bold text-sui tabular-nums" : "font-bold text-owes tabular-nums"}>
                        {b.netMinor > 0n ? "+" : "−"}
                        {naira(b.netMinor)}
                      </span>
                      <span className="block text-xs text-ink-muted">{b.netMinor > 0n ? "gets back" : "owes"}</span>
                    </p>
                  )}
                </Row>
              ))}
            </Section>

            <Section id="recent" className="order-8" title="Recent expenses" note={`Latest ${recent.length} of ${entryCount}.`}>
              {recent.map((e) => (
                <Row key={e.id}>
                  <CategoryIcon category={e.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-sm text-ink-muted">
                      {name(e.payerId)} paid · {shortDate(e.date)}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums">{naira(e.amountMinor)}</p>
                </Row>
              ))}
            </Section>
          </div>

          <div className="contents lg:block lg:space-y-6">
            <Section
              id="turns"
              className="order-5"
              title="Whose turn"
              note={<WithMemory off="Memory off: no suggestions.">{learnedNote}</WithMemory>}
            >
              <WithMemory off={<MemoryOffRow title="No suggestions" body="Without memory it can't know Tolu keeps buying the diesel." />}>
                {memory.turns.length === 0 && <MemoryOffRow title="Nothing learned yet" body="No whose-turn pattern in memory." />}
                {memory.turns.map((t) => (
                  <ExplainRow key={t.category} explanation={t.explanation} memory={t.memory}>
                    <CategoryIcon category={t.category} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {CATEGORY_NAME[t.category]}: <span className="font-bold text-sui">{name(t.nextPayerId)}</span>
                      </p>
                      <p className="text-sm text-ink-muted">
                        {name(t.usualPayerId)} paid {t.usualCount} of the last {t.totalCount}
                      </p>
                    </div>
                  </ExplainRow>
                ))}
              </WithMemory>
            </Section>

            <Section
              id="upcoming"
              className="order-6"
              title="Coming up"
              note={<WithMemory off="Memory off: no reminders.">{learnedNote}</WithMemory>}
            >
              <WithMemory off={<MemoryOffRow title="No reminders" body="Without memory it can't tell which bills come back every month." />}>
                {memory.bills.length === 0 && <MemoryOffRow title="Nothing learned yet" body="No repeating bill in memory." />}
                {memory.bills.map((u) => {
                  const due = dueLabel(u.nextExpectedDate, view.asOf);
                  return (
                    <ExplainRow key={u.category} explanation={u.explanation} memory={u.memory}>
                      <CategoryIcon category={u.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.description}</p>
                        <p className="text-sm text-ink-muted">
                          {CADENCE[u.cadence]} · {shortDate(u.nextExpectedDate)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-bold tabular-nums">{naira(u.expectedAmountMinor)}</p>
                        <Chip tone={due === "Today" ? "teal" : "muted"}>{due}</Chip>
                      </div>
                    </ExplainRow>
                  );
                })}
              </WithMemory>
            </Section>

            <Section
              id="speed"
              className="order-7"
              title="Settle speed"
              note={<WithMemory off="Memory off: everyone looks the same.">{learnedNote}</WithMemory>}
            >
              <WithMemory off={<MemoryOffRow title="No history" body="Without memory every flatmate looks equally reliable." />}>
                {memory.habits.length === 0 && <MemoryOffRow title="Nothing learned yet" body="No settle-speed habits in memory." />}
                {memory.habits.map((r) => (
                  <ExplainRow key={r.memberId} explanation={r.explanation} memory={r.memory}>
                    <Avatar name={name(r.memberId)} index={at(r.memberId)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">{name(r.memberId)}</p>
                        <p className="text-sm text-ink-muted">
                          {SPEED[r.label]} · ~{r.medianDelay} {r.medianDelay === 1 ? "day" : "days"}
                        </p>
                      </div>
                      <div className="mt-2">
                        <Meter value={r.score} tone={r.label === "fast" ? "sui" : r.label === "slow" ? "owes" : "muted"} />
                      </div>
                    </div>
                  </ExplainRow>
                ))}
              </WithMemory>
            </Section>
          </div>
        </div>

        <Timeline memory={memory} members={members} />

        <p className="mt-10 text-center text-xs text-pretty text-ink-muted">
          Sample flat with made-up numbers, as of {fullDate(view.asOf)}. Read-only. Balances come from the ledger; suggestions come from memory on
          Walrus.{" "}
          <Link href="/status" className="font-medium text-sui underline-offset-2 hover:underline">
            Live system status
          </Link>
        </p>
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto w-fit rounded-full bg-navy/90 p-1.5 shadow-[0_12px_32px_-8px_oklch(0.2_0.08_262/0.6)] backdrop-blur-xl lg:hidden"
      >
        <ul className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <a
                href={href}
                className="flex h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[0.6875rem] font-medium text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              >
                <Icon aria-hidden className="size-4" strokeWidth={2} />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
    </MemoryProvider>
  );
}
