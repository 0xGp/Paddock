import type { Explanation } from "@splitsense/engine";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { usdcText } from "@/lib/format";
import type { MemoryRef } from "@/server/memory";
import { MemoryLink } from "./memory";

/** A list row that opens in place to show the facts, formula and threshold behind it. */
export function ExplainRow({ explanation, rate, memory, children }: { explanation: Explanation; rate: number; memory?: MemoryRef; children: ReactNode }) {
  const entries = explanation.evidenceExpenseIds.length;
  return (
    <li>
      <details className="explain group">
        <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 select-none hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sui">
          <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-out group-open:rotate-90"
            strokeWidth={2}
          />
        </summary>
        <div className="explain-panel px-3 pb-3">
          <div className="rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-line">
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
              {explanation.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-ink-muted">{f.label}</dt>
                  <dd className="text-right font-medium tabular-nums">{usdcText(f.value, rate)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-pretty text-ink-muted">
              <p>
                Worked out as <code className="font-mono text-ink">{usdcText(explanation.formula, rate)}</code>
              </p>
              <p>Shown when {usdcText(explanation.threshold, rate)}</p>
              {memory ? (
                <MemoryLink memory={memory} />
              ) : (
                <p>
                  Based on {entries} {entries === 1 ? "entry" : "entries"} in the ledger.
                </p>
              )}
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
