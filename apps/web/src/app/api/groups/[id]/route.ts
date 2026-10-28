import { groupView } from "@/server/groups";
import { handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** One group as its member sees it: balances, bills, payments, invite. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => groupView((await params).id, await requireSession()));
}
