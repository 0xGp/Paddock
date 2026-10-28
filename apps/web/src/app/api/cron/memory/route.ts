import { env } from "@/env";
import { pumpOutbox, refreshDemoMemory } from "@/server/memory";

export const maxDuration = 60;

/** Scheduled: one paced outbox step, then a forced recall of the demo group from Walrus. */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const outbox = await pumpOutbox();
  const memory = await refreshDemoMemory({ force: true });
  return Response.json({ ok: true, outbox, memory });
}
