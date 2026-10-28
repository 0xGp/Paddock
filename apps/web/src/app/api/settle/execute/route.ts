import { after } from "next/server";
import { z } from "zod";
import { demoGroupId } from "@/server/demo";
import { AppError, crossSite, fail, json, suiAddress } from "@/server/http";
import { publishReceipts } from "@/server/memory";
import { executeSettlement } from "@/server/wallet";

export const maxDuration = 120;

const body = z.object({
  address: suiAddress,
  group: z.string().min(1).max(64).default(demoGroupId),
  to: z.string().min(1).max(64),
  microUsdc: z.string().regex(/^\d{1,15}$/),
  bytes: z.string().min(1).max(16_000),
  signature: z.string().min(1).max(4_000),
});

/** Submits a wallet-signed settlement through Tatum, confirms it, and writes its receipt to Walrus. */
export async function POST(req: Request) {
  if (crossSite(req)) return fail("cross-site requests are not allowed", 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { address, group, to, microUsdc, bytes, signature }");
  try {
    const result = await executeSettlement({ ...parsed.data, microUsdc: BigInt(parsed.data.microUsdc) });
    if (result.receipt) after(() => publishReceipts().catch((e) => console.error("receipt publish failed", e)));
    return json(result);
  } catch (e) {
    if (e instanceof AppError) return fail(e.message, e.status);
    return fail(`payment failed: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
}
