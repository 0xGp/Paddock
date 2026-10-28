import { z } from "zod";
import { displayName, getProfile, myGroups, setProfileName } from "@/server/groups";
import { body, handle } from "@/server/http";
import { requireSession } from "@/server/session";

/** The signed-in wallet's name and its groups with balances. */
export async function GET() {
  return handle(async () => {
    const address = await requireSession();
    const [profile, groups] = await Promise.all([getProfile(address), myGroups(address)]);
    return { address, profile, groups };
  });
}

/** Sets the name friends see, in every group the wallet is in. */
export async function PUT(req: Request) {
  return handle(async () => {
    const address = await requireSession();
    const { name } = await body(req, z.object({ name: displayName }), "{ name }");
    return setProfileName(address, name);
  });
}
