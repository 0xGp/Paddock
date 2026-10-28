import { crossSite, fail, handle } from "@/server/http";
import { endSession, sessionAddress } from "@/server/session";

/** Which address this browser is signed in as, if any. */
export async function GET() {
  return handle(async () => ({ address: await sessionAddress() }));
}

/** Signs this browser out. */
export async function DELETE(req: Request) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  return handle(async () => {
    await endSession();
    return { address: null };
  });
}
