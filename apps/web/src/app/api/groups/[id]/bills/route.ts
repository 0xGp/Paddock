import { addBill, newBill } from "@/server/groups";
import { body, handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** Adds a bill, split equally between the people picked. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const address = await requireSession();
    const input = await body(req, newBill, "{ description, amountMinor, category, payerId, participantIds, date }");
    return addBill((await params).id, address, input);
  });
}
