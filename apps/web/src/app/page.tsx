import type { Metadata } from "next";
import { Onboarding } from "./_onboarding/onboarding";

export const metadata: Metadata = {
  title: "Paddock · Split the flat, settle on Sui",
  description: "The flat money app that remembers how your flat lives, settles in USDC on Sui, and shows its working.",
};

export default function Home() {
  return <Onboarding />;
}
