import { rotateInvite } from "@/server/groups";
import { crossSite, fail, handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** Issues a new invite link; the old one stops working. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  return handle(async () => rotateInvite((await params).id, await requireSession()));
}
