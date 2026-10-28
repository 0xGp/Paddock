import type { Metadata } from "next";
import { Suspense } from "react";
import { AddBillScreen } from "./add-bill";

export const metadata: Metadata = { title: "Add a bill · Paddock" };

export default function AddBillPage() {
  return (
    <Suspense fallback={<div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />}>
      <AddBillScreen />
    </Suspense>
  );
}
