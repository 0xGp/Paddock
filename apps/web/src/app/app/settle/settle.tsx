"use client";

import { BadgeCheck, Check, CircleAlert, Database, ExternalLink, Fuel, LoaderCircle, PartyPopper, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/app/demo/_components/parts";
import { useWallet } from "@/components/wallet/provider";
import { cn } from "@/lib/cn";
import { naira, parseUsdc, shortId, suiscanTx, usdcAmount } from "@/lib/format";
import { refreshAll, useBalances, useGroup, type GroupData } from "../_components/data";
import { DebtList, NetLine } from "../_components/groups";
import { EmptyState, Panel, useAccess } from "../_components/shell";

const MIN_MICRO = 10_000n;

type Step = "build" | "sign" | "confirm" | "receipt";
type Phase = { at: "idle" } | { at: Step } | { at: "done"; result: Settled } | { at: "error"; step: Step; message: string };

interface Settled {
  digest: string;
  checkpoint: number | null;
  executeMs: number;
  confirmMs: number;
  amountMinor: string;
  receipt: boolean;
  microUsdc: bigint;
  toName: string;
  groupId: string;
}

/** The whole debt if the wallet covers it, else as many whole cents as it holds. */
function suggested(debt: bigint, balance: bigint | null) {
  if (balance === null || debt <= balance) return debt;
  const cents = balance - (balance % MIN_MICRO);
  return cents > MIN_MICRO ? cents : MIN_MICRO;
}

const post = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data as T;
};

export function SettleScreen() {
  const params = useSearchParams();
  const group = params.get("group");
  return group ? <GroupSettle id={group} initialTo={params.get("to")} /> : <Picker />;
}

/** Everyone you owe, across all your groups. */
function Picker() {
  const { me } = useAccess();
  const groups = (me.data?.groups ?? []).filter((g) => g.owe.length > 0);
  if (groups.length === 0)
    return (
      <Panel className="mx-auto max-w-xl">
        <EmptyState icon={<Check className="size-6" />} title="You're all square" body="You don't owe anyone in any of your groups right now. When you do, you can settle it here.">
          <Link href="/app" className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
            Back home
          </Link>
        </EmptyState>
      </Panel>
    );
  return (
    <div className="mx-auto max-w-xl space-y-5">
      {groups.map((g) => (
        <Panel key={g.id} title={g.name} action={<NetLine net={BigInt(g.net)} className="text-sm" />}>
          <DebtList label="You pay" rows={g.owe} at={(id) => Math.max(0, g.members.findIndex((m) => m.id === id))} payHref={(d) => `/app/settle?group=${g.id}&to=${d.memberId}`} />
        </Panel>
      ))}
    </div>
  );
}

function GroupSettle({ id, initialTo }: { id: string; initialTo: string | null }) {
  const { wallet } = useWallet();
  const { address } = useAccess();
  const group = useGroup(id, address);
  const balances = useBalances(address);
  const g = group.data;

  if (!g && group.error)
    return (
      <Panel className="mx-auto max-w-xl">
        <EmptyState icon={<Users className="size-6" />} title="Can't settle here" body={group.error}>
          <Link href="/app/settle" className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
            Back
          </Link>
        </EmptyState>
      </Panel>
    );
  if (!g || !balances.data) return <div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />;
  if (g.owe.length === 0)
    return (
      <Panel className="mx-auto max-w-xl">
        <EmptyState icon={<Check className="size-6" />} title="You're all square" body={`You don't owe anyone in ${g.name} right now.`}>
          <Link href={`/app/g/${g.id}`} className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
            Open {g.name}
          </Link>
        </EmptyState>
      </Panel>
    );

  return (
    <SettleForm
      key={g.id}
      address={address!}
      walletName={wallet?.name ?? "your wallet"}
      flat={g}
      balanceMicro={balances.data.balances.ok ? BigInt(balances.data.balances.usdcMicro) : null}
      initialTo={initialTo}
    />
  );
}

function SettleForm({
  address,
  walletName,
  flat,
  balanceMicro,
  initialTo,
}: {
  address: string;
  walletName: string;
  flat: GroupData;
  balanceMicro: bigint | null;
  initialTo: string | null;
}) {
  const { sign } = useWallet();
  const router = useRouter();
  const [to, setTo] = useState(flat.owe.find((o) => o.memberId === initialTo)?.memberId ?? flat.owe[0]!.memberId);
  const debt = flat.owe.find((o) => o.memberId === to)!;
  const debtMicro = BigInt(debt.microUsdc);
  const [text, setText] = useState(() => usdcAmount(suggested(debtMicro, balanceMicro), true));
  const [phase, setPhase] = useState<Phase>({ at: "idle" });
  const at = (id: string) => Math.max(0, flat.members.findIndex((m) => m.id === id));

  const micro = parseUsdc(text);
  const problem =
    micro === null
      ? "Enter an amount in USDC."
      : micro < MIN_MICRO
        ? "The smallest payment is 0.01 USDC."
        : micro > debtMicro
          ? `You only owe ${debt.name} ${usdcAmount(debtMicro, true)} USDC.`
          : balanceMicro !== null && micro > balanceMicro
            ? `Your wallet has ${usdcAmount(balanceMicro, true)} USDC.`
            : null;
  const kobo = micro === null ? 0n : (micro * BigInt(flat.rate) * 100n) / 1_000_000n;

  const pay = async () => {
    if (micro === null || problem) return;
    const body = { address, group: flat.id, to, microUsdc: micro.toString() };
    let step: Step = "build";
    try {
      setPhase({ at: "build" });
      const { bytes } = await post<{ bytes: string }>("/api/settle/prepare", body);
      step = "sign";
      setPhase({ at: "sign" });
      const signed = await sign(bytes);
      step = "confirm";
      setPhase({ at: "confirm" });
      const result = await post<Omit<Settled, "microUsdc" | "toName" | "groupId">>("/api/settle/execute", { ...body, bytes: signed.bytes, signature: signed.signature });
      setPhase({ at: "receipt" });
      await new Promise((r) => setTimeout(r, 700));
      setPhase({ at: "done", result: { ...result, microUsdc: micro, toName: debt.name, groupId: flat.id } });
    } catch (e) {
      setPhase({ at: "error", step, message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (phase.at === "done")
    return (
      <Success
        result={phase.result}
        onLeave={(href) => {
          refreshAll();
          router.push(href);
        }}
      />
    );
  const busy = phase.at !== "idle" && phase.at !== "error";

  return (
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-6">
      <div className="space-y-5">
        <Panel title="Who are you paying?">
          <div role="radiogroup" aria-label="Flatmate" className="space-y-1 p-1">
            {flat.owe.map((o) => (
              <button
                key={o.memberId}
                type="button"
                role="radio"
                aria-checked={o.memberId === to}
                disabled={busy}
                onClick={() => {
                  setTo(o.memberId);
                  setText(usdcAmount(suggested(BigInt(o.microUsdc), balanceMicro), true));
                }}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 transition-all",
                  o.memberId === to ? "bg-white/80 ring-sui/40" : "ring-transparent hover:bg-white/40",
                )}
              >
                <Avatar name={o.name} index={at(o.memberId)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.name}</span>
                  <span className="block text-xs text-ink-muted">
                    You owe {naira(BigInt(o.amountMinor))} · {usdcAmount(BigInt(o.microUsdc))} USDC
                  </span>
                </span>
                <span aria-hidden className={cn("grid size-5 place-items-center rounded-full ring-2", o.memberId === to ? "bg-sui ring-sui" : "ring-ink/20")}>
                  {o.memberId === to && <span className="size-2 rounded-full bg-white" />}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="How much?">
          <div className="px-3 pb-3">
            <label htmlFor="amount" className="sr-only">
              Amount in USDC
            </label>
            <div className={cn("flex items-baseline gap-2 rounded-2xl bg-white/70 px-4 py-4 ring-1", problem ? "ring-owes/30" : "ring-ink/[0.06] focus-within:ring-sui/50")}>
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value.replace(",", "."))}
                aria-invalid={Boolean(problem)}
                aria-describedby="amount-help"
                className="w-full min-w-0 bg-transparent text-4xl font-bold tabular-nums outline-none"
              />
              <span className="text-lg font-semibold text-ink-muted">USDC</span>
            </div>
            <p id="amount-help" className={cn("mt-2 text-sm", problem ? "text-owes" : "text-ink-muted")}>
              {problem ?? `≈ ${naira(kobo)} of the ${naira(BigInt(debt.amountMinor))} you owe ${debt.name}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Full amount", value: debtMicro },
                ...(balanceMicro !== null && balanceMicro < debtMicro ? [{ label: "All my USDC", value: balanceMicro }] : []),
                { label: "0.01", value: MIN_MICRO },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  disabled={busy}
                  onClick={() => setText(usdcAmount(c.value, true))}
                  className="h-9 rounded-full bg-ink/[0.05] px-3.5 text-sm font-semibold hover:bg-ink/[0.08]"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Wallet balance: {balanceMicro === null ? "unavailable" : `${usdcAmount(balanceMicro, true)} USDC`}
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Review" className="lg:sticky lg:top-24">
        <dl className="divide-y divide-line px-3">
          <div className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-ink-muted">To</dt>
            <dd className="font-semibold">{debt.name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-ink-muted">Amount</dt>
            <dd className="font-semibold tabular-nums">{micro !== null ? usdcAmount(micro, true) : "—"} USDC</dd>
          </div>
          <div className="flex justify-between gap-4 py-3 text-sm">
            <dt className="flex items-center gap-1.5 text-ink-muted">
              <Fuel aria-hidden className="size-3.5" />
              Network fee
            </dt>
            <dd className="font-semibold text-sui">0 SUI</dd>
          </div>
        </dl>

        <ol className="mt-2 space-y-1 px-3 py-2" aria-label="Progress">
          {(
            [
              ["build", "Build the payment"],
              ["sign", `Approve in ${walletName}`],
              ["confirm", "Send and confirm through Tatum"],
              ["receipt", flat.memory ? "Write the receipt to Walrus" : "Save the receipt"],
            ] as const
          ).map(([s, label]) => (
            <StepRow key={s} label={label} state={stepState(phase, s)} />
          ))}
        </ol>

        {phase.at === "error" && (
          <p role="alert" className="mx-2 mt-1 flex gap-2 rounded-2xl bg-owes/[0.08] px-3 py-3 text-sm text-owes">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {phase.message}
          </p>
        )}

        <div className="p-1 pt-3">
          <button
            type="button"
            onClick={pay}
            disabled={Boolean(problem) || busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {busy ? "Settling…" : phase.at === "error" ? "Try again" : `Pay ${micro !== null && !problem ? usdcAmount(micro, true) : ""} USDC`}
          </button>
          <p className="mt-3 px-2 pb-1 text-center text-xs text-pretty text-ink-muted">You sign in your wallet. SplitSense never holds your funds.</p>
        </div>
      </Panel>
    </div>
  );
}

const ORDER: Step[] = ["build", "sign", "confirm", "receipt"];

function stepState(phase: Phase, step: Step): "todo" | "active" | "done" | "failed" {
  if (phase.at === "idle") return "todo";
  if (phase.at === "done") return "done";
  const current = phase.at === "error" ? phase.step : phase.at;
  const i = ORDER.indexOf(step);
  const c = ORDER.indexOf(current);
  if (i < c) return "done";
  if (i > c) return "todo";
  return phase.at === "error" ? "failed" : "active";
}

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" | "failed" }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full",
          state === "done" ? "bg-sui text-white" : state === "active" ? "bg-sui-soft text-sui" : state === "failed" ? "bg-owes/10 text-owes" : "bg-ink/[0.06] text-ink-muted",
        )}
      >
        {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : state === "active" ? <LoaderCircle className="size-3.5 animate-spin" /> : state === "failed" ? <CircleAlert className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={cn(state === "todo" ? "text-ink-muted" : "font-medium")}>{label}</span>
      <span className="sr-only">{state === "done" ? "done" : state === "active" ? "in progress" : state === "failed" ? "failed" : "not started"}</span>
    </li>
  );
}

function Success({ result, onLeave }: { result: Settled; onLeave: (href: string) => void }) {
  return (
    <Panel className="mx-auto max-w-md">
      <div className="hero-card relative overflow-hidden rounded-[1.5rem] px-6 pt-10 pb-8 text-center text-white">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white text-sui shadow-lg">
          <PartyPopper aria-hidden className="size-7" />
        </span>
        <p className="mt-5 text-sm text-white/75">Paid {result.toName}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{usdcAmount(result.microUsdc)} USDC</p>
        <p className="mt-1 text-sm text-white/75 tabular-nums">{naira(BigInt(result.amountMinor))} off what you owe</p>
      </div>
      <dl className="divide-y divide-line px-4 py-2">
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-ink-muted">Transaction</dt>
          <dd>
            <a href={suiscanTx(result.digest)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[0.8125rem] text-sui hover:underline">
              {shortId(result.digest)}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <BadgeCheck aria-hidden className="size-4 text-sui" />
            Confirmed through Tatum
          </dt>
          <dd className="font-medium tabular-nums">{(result.confirmMs / 1000).toFixed(1)} s</dd>
        </div>
        {result.checkpoint !== null && (
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-ink-muted">Checkpoint</dt>
            <dd className="font-medium tabular-nums">{result.checkpoint.toLocaleString("en-US")}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <Database aria-hidden className="size-4" />
            Receipt
          </dt>
          <dd className="font-medium">{result.receipt ? "Writing to Walrus" : "Saved in SplitSense"}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2 p-2">
        <button type="button" onClick={() => onLeave("/app/activity")} className="glass flex h-12 items-center justify-center rounded-full text-sm font-semibold">
          View activity
        </button>
        <button type="button" onClick={() => onLeave(`/app/g/${result.groupId}`)} className="flex h-12 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
          Done
        </button>
      </div>
    </Panel>
  );
}
