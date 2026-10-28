import { deleteBill } from "@/server/groups";
import { crossSite, fail, handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** Removes a bill; only whoever added it can. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; billId: string }> }) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  return handle(async () => {
    const { id, billId } = await params;
    return deleteBill(id, billId, await requireSession());
  });
}
