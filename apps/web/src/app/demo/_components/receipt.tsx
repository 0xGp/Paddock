import { ArrowUpRight, ChevronRight } from "lucide-react";
import { shortId, stamp, suiscanAccount, suiscanTx } from "@/lib/format";
import type { LearnedReceipt } from "@/server/memory";
import { MemoryLink } from "./memory";
import { Avatar, Chip } from "./parts";

const usdcOf = (micro: bigint) => `${(Number(micro) / 1_000_000).toLocaleString("en-NG", { maximumFractionDigits: 6 })} USDC`;

function ChainLink({ href, children, label }: { href: string; children: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-mono text-xs font-medium text-sui underline-offset-2 hover:underline">
      {children}
      <ArrowUpRight aria-hidden className="size-3" strokeWidth={2.5} />
      <span className="sr-only">({label}, opens Suiscan)</span>
    </a>
  );
}

/** A settlement read back from its Walrus receipt, with the on-chain transaction behind it. */
export function ReceiptRow({ receipt, name, at }: { receipt: LearnedReceipt; name: (id: string) => string; at: (id: string) => number }) {
  const r = receipt;
  return (
    <li>
      <details className="explain group">
        <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 select-none hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sui">
          <Avatar name={name(r.from)} index={at(r.from)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {name(r.from)} <span className="text-ink-muted">paid</span> {name(r.to)}
            </p>
            <p className="text-sm text-ink-muted tabular-nums">{stamp(r.settledAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="font-bold tabular-nums">{usdcOf(r.microUsdc)}</p>
            <Chip tone="teal">On Sui</Chip>
          </div>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-out group-open:rotate-90" strokeWidth={2} />
        </summary>
        <div className="explain-panel px-3 pb-3">
          <div className="rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-line">
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
              <dt className="text-ink-muted">Transaction</dt>
              <dd className="text-right">
                <ChainLink href={suiscanTx(r.digest)} label="Sui transaction">
                  {shortId(r.digest)}
                </ChainLink>
              </dd>
              {r.checkpoint && (
                <>
                  <dt className="text-ink-muted">Checkpoint</dt>
                  <dd className="text-right font-medium tabular-nums">{Number(r.checkpoint).toLocaleString("en-NG")}</dd>
                </>
              )}
              <dt className="text-ink-muted">From {name(r.from)}</dt>
              <dd className="text-right">
                <ChainLink href={suiscanAccount(r.fromAddress)} label={`${name(r.from)}'s address`}>
                  {shortId(r.fromAddress)}
                </ChainLink>
              </dd>
              <dt className="text-ink-muted">To {name(r.to)}</dt>
              <dd className="text-right">
                <ChainLink href={suiscanAccount(r.toAddress)} label={`${name(r.to)}'s address`}>
                  {shortId(r.toAddress)}
                </ChainLink>
              </dd>
            </dl>
            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-pretty text-ink-muted">
              <p>Confirmed through Tatum before it was remembered: exactly {usdcOf(r.microUsdc)} left {name(r.from)} and reached {name(r.to)}.</p>
              <MemoryLink memory={r.memory} />
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
