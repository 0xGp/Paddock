import { z } from "zod";
import { body, handle, suiAddress } from "@/server/http";
import { completeSignIn } from "@/server/session";

const input = z.object({ address: suiAddress, bytes: z.string().min(1).max(4_000), signature: z.string().min(1).max(4_000) });

/** Verifies the signed challenge and sets the session cookie. */
export async function POST(req: Request) {
  return handle(async () => ({ address: await completeSignIn(req, await body(req, input, "{ address, bytes, signature }")) }));
}
