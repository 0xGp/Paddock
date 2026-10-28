"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const MemoryContext = createContext<{ on: boolean; setOn: (on: boolean) => void }>({ on: true, setOn: () => {} });

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(true);
  return <MemoryContext value={{ on, setOn }}>{children}</MemoryContext>;
}

/** Shows `children` while memory is on and `off` while it's off. Both are rendered on the server. */
export function WithMemory({ children, off }: { children: ReactNode; off: ReactNode }) {
  return use(MemoryContext).on ? children : off;
}

export function MemorySwitch({ className }: { className?: string }) {
  const { on, setOn } = use(MemoryContext);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className={cn(
        "glass flex h-10 items-center gap-2.5 rounded-full pr-1.5 pl-3.5 text-xs font-semibold transition-transform duration-150 active:scale-[0.97]",
        className,
      )}
    >
      <span className={on ? "text-sui" : "text-ink-muted"}>Memory {on ? "on" : "off"}</span>
      <span aria-hidden className={cn("relative h-6 w-10 rounded-full transition-colors duration-150 ease-out", on ? "bg-sui" : "bg-ink/15")}>
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
            on && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

/** Asks the server to re-recall from Walrus in the background, once per browser session. */
export function RefreshOnVisit() {
  useEffect(() => {
    if (sessionStorage.getItem("ss-memory-refresh")) return;
    sessionStorage.setItem("ss-memory-refresh", "1");
    fetch("/api/memory/refresh", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
