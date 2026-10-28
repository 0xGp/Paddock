import { ArrowLeft, ArrowUpRight, CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { clock, stamp } from "@/lib/format";
import { getStatus, type StatusCheck } from "@/server/status";
import { Brand, Chip, Section } from "../demo/_components/parts";

export const metadata: Metadata = {
  title: "Status · Paddock",
  description: "Live calls to Tatum's Sui Mainnet GraphQL gateway and the Walrus memory relayer, with what each returned and how long it took.",
};

/** `free;ratelimit=3;strategy=shared` → "Free plan, 3 requests/s". */
function planLabel(plan: string | null): string | null {
  if (!plan) return null;
  const [tier, ...rest] = plan.split(";");
  const limit = rest.find((p) => p.startsWith("ratelimit="))?.split("=")[1];
  const name = tier ? `${tier.slice(0, 1).toUpperCase()}${tier.slice(1)} plan` : "Plan";
  return limit ? `${name}, ${limit} requests/s` : name;
}

function CheckRow({ check }: { check: StatusCheck }) {
  const Icon = check.ok ? CircleCheck : CircleX;
  return (
    <li className="rounded-2xl px-3 py-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl", check.ok ? "bg-teal/40 text-teal-ink" : "bg-owes/10 text-owes")}>
          <Icon className="size-[1.125rem]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-medium">
              {check.title}
              <span className="sr-only">{check.ok ? " (passed)" : " (failed)"}</span>
            </h3>
            {check.attempts > 0 && (
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {check.ms.toLocaleString("en-NG")} ms
                {check.attempts > 1 && <span className="font-normal text-ink-muted"> · {check.attempts} tries</span>}
              </p>
            )}
          </div>
          {check.error && <p className="mt-0.5 text-sm text-pretty text-owes">{check.error}</p>}
          {check.facts.length > 0 && (
            <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {check.facts.map((f, i) => (
                <div key={`${f.label}-${i}`} className="contents">
                  <dt className={cn("truncate text-ink-muted", f.mono && f.label.startsWith("0x") && "font-mono text-xs leading-5")}>{f.label}</dt>
                  <dd className={cn("min-w-0 truncate text-right tabular-nums", f.mono && "font-mono text-xs leading-5")}>
                    {f.href ? (
                      <a href={f.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-sui underline-offset-2 hover:underline">
                        {f.value}
                        <ArrowUpRight aria-hidden className="size-3" strokeWidth={2.5} />
                        <span className="sr-only">(opens Suiscan)</span>
                      </a>
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <details className="group mt-2">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted select-none hover:text-ink">
              {check.service === "tatum" ? "GraphQL sent to Tatum" : "SDK call"}
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-navy p-3 font-mono text-[0.6875rem] leading-relaxed text-white/85">
              {check.call}
              {check.variables && `\n\nvariables ${JSON.stringify(check.variables, null, 2)}`}
            </pre>
          </details>
        </div>
      </div>
    </li>
  );
}

export default async function StatusPage() {
  const report = await getStatus();
  const failing = report.checks.filter((c) => !c.ok).length;
  const tatum = report.checks.filter((c) => c.service === "tatum");
  const walrus = report.checks.filter((c) => c.service === "walrus");
  const tatumMs = tatum.reduce((s, c) => s + c.ms, 0);
  const plan = planLabel(report.plan);

  return (
    <div className="min-h-dvh">
      <div aria-hidden className="backdrop" />

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <Brand tag="Status" />
        <Link
          href="/demo"
          className="glass flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-navy transition-transform duration-150 active:scale-[0.97]"
        >
          <ArrowLeft aria-hidden className="size-4" strokeWidth={2} />
          Demo flat
        </Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-6 pb-16 sm:px-6">
        <section aria-labelledby="overall" className="hero-card rounded-[2rem] p-6 text-white">
          <p className="text-sm font-semibold">Live from Sui Mainnet</p>
          <h1 id="overall" className="mt-6 text-3xl font-bold text-balance sm:text-4xl">
            {failing === 0 ? "Every check answered" : `${failing} of ${report.checks.length} checks failed`}
          </h1>
          <p className="mt-2 text-sm text-pretty text-white/75">
            Checked at {clock(report.checkedAt)} WAT, {stamp(report.checkedAt).split(",")[0]}. Results are kept for 30 seconds, so a busy page still
            makes at most three Tatum requests every half minute.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="col-span-2 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-md sm:col-span-1">
              <dt className="text-white/70">Gateway</dt>
              <dd className="mt-0.5 truncate font-semibold" title={report.endpoint}>
                {report.endpoint}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
              <dt className="text-white/70">Tatum time</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{tatumMs.toLocaleString("en-NG")} ms for 3 calls</dd>
            </div>
            {plan && (
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
                <dt className="text-white/70">Tatum plan</dt>
                <dd className="mt-0.5 font-semibold">{plan}</dd>
              </div>
            )}
          </dl>
        </section>

        <Section
          id="tatum"
          title="Tatum: Sui Mainnet GraphQL"
          note={
            <>
              Every on-chain read in Paddock goes through Tatum.{" "}
              <Chip tone={tatum.every((c) => c.ok) ? "teal" : "muted"}>
                {tatum.filter((c) => c.ok).length}/{tatum.length} answered
              </Chip>
            </>
          }
        >
          {tatum.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </Section>

        <Section
          id="walrus"
          title="Walrus memory"
          note={
            <>
              Where Paddock keeps what it learned.{" "}
              <Chip tone={walrus.every((c) => c.ok) ? "teal" : "muted"}>
                {walrus.filter((c) => c.ok).length}/{walrus.length} answered
              </Chip>
            </>
          }
        >
          {walrus.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </Section>

        <p className="text-center text-xs text-pretty text-ink-muted">
          The transaction above is the demo flat’s first settlement: Emeka paid Godspower 0.01 USDC with no gas, built, executed and confirmed
          through Tatum.
        </p>
      </main>
    </div>
  );
}
