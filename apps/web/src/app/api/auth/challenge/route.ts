import { z } from "zod";
import { body, handle, suiAddress } from "@/server/http";
import { createChallenge } from "@/server/session";

/** The text a wallet signs to prove it owns the address. */
export async function POST(req: Request) {
  return handle(async () => {
    const { address } = await body(req, z.object({ address: suiAddress }), "{ address }");
    return { message: await createChallenge(req, address) };
  });
}
