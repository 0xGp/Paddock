import { invitePreview, joinGroup } from "@/server/groups";
import { AppError, crossSite, fail, handle } from "@/server/http";
import { requireSession } from "@/server/session";

const CODE = /^[0-9A-Za-z]{6,32}$/;

async function code(params: Promise<{ code: string }>) {
  const { code } = await params;
  if (!CODE.test(code)) throw new AppError("this invite link isn't valid", 404);
  return code;
}

/** The group behind an invite link: name and first names only. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => invitePreview(await code(params)));
}

/** Joins the signed-in wallet to the group. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  return handle(async () => joinGroup(await requireSession(), await code(params)));
}
