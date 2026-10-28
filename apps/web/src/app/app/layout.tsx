import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "./_components/shell";

export const metadata: Metadata = {
  title: "Paddock",
  description: "Split bills with your flatmates or friends at an event, then settle up in USDC on Sui.",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh">
          <div aria-hidden className="backdrop" />
          <div className="glass mx-auto mt-24 h-72 max-w-md animate-pulse rounded-[2rem]" />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
