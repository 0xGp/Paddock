import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupScreen } from "./group";

export const metadata: Metadata = { title: "Group · Paddock" };

export default function GroupPage() {
  return (
    <Suspense fallback={<div className="glass mx-auto h-96 max-w-xl animate-pulse rounded-[1.75rem]" />}>
      <GroupScreen />
    </Suspense>
  );
}
