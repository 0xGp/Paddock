import { z } from "zod";
import { demoGroupId } from "@/server/demo";
import { AppError, crossSite, fail, json, suiAddress } from "@/server/http";
import { prepareSettlement } from "@/server/wallet";

const body = z.object({
  address: suiAddress,
  group: z.string().min(1).max(64).default(demoGroupId),
  to: z.string().min(1).max(64),
  microUsdc: z.string().regex(/^\d{1,15}$/),
});

/** The unsigned, gasless settlement transaction, built through Tatum. */
export async function POST(req: Request) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { address, group, to, microUsdc }");
  try {
    const { bytes } = await prepareSettlement(parsed.data.address, parsed.data.group, parsed.data.to, BigInt(parsed.data.microUsdc));
    return json({ bytes });
  } catch (e) {
    if (e instanceof AppError) return fail(e.message, e.status);
    return fail(`couldn't build the payment: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
}
