import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen } from "./join";

export const metadata: Metadata = {
  title: "You're invited · SplitSense",
  description: "Join to split bills and settle up in USDC on Sui.",
};

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="glass mx-auto h-96 max-w-md animate-pulse rounded-[2rem]" />}>
      <JoinScreen />
    </Suspense>
  );
}
