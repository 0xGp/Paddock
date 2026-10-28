import type { Metadata } from "next";
import { Suspense } from "react";
import { SettleScreen } from "./settle";

export const metadata: Metadata = { title: "Settle up · SplitSense" };

export default function SettlePage() {
  return (
    <Suspense fallback={<div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />}>
      <SettleScreen />
    </Suspense>
  );
}
