import { createGroup, newGroup } from "@/server/groups";
import { body, handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** Creates a flat or event with the signed-in wallet as its first member. */
export async function POST(req: Request) {
  return handle(async () => {
    const address = await requireSession();
    return createGroup(address, await body(req, newGroup, "{ name, kind, place?, rate }"));
  });
}
