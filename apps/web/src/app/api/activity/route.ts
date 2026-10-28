import { handle } from "@/server/http";
import { requireSession } from "@/server/session";
import { activity } from "@/server/wallet";

/** Confirmed payments across the signed-in wallet's groups, with their Walrus receipts. */
export async function GET() {
  return handle(async () => activity(await requireSession()));
}
