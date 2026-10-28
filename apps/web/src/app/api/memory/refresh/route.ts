import { after } from "next/server";
import { refreshDemoMemory } from "@/server/memory";

export const maxDuration = 60;

/** Called by /demo on visit. Throttled server-side to one Walrus recall per interval. */
export function POST() {
  after(async () => {
    try {
      await refreshDemoMemory();
    } catch (error) {
      console.error("memory refresh failed", error);
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}
