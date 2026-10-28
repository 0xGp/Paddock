import { fail, json, suiAddress } from "@/server/http";
import { walletBalances } from "@/server/wallet";

/** A wallet's USDC and SUI, read through Tatum. Public chain data only. */
export async function GET(req: Request) {
  const address = suiAddress.safeParse(new URL(req.url).searchParams.get("address"));
  if (!address.success) return fail("expected ?address=0x…");
  return json({ address: address.data, balances: await walletBalances(address.data) });
}
