import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeAddress } from "@splitsense/chain";
import { fromBase64 } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { cookies } from "next/headers";
import { env } from "@/env";
import { AppError } from "@/server/http";
import { suiClient } from "@/server/tatum";

const SESSION_COOKIE = "ss_session";
const NONCE_COOKIE = "ss_nonce";
const SESSION_SEC = 30 * 86_400;
const NONCE_SEC = 300;

const mac = (body: string) => createHmac("sha256", env.SESSION_SECRET).update(body).digest("base64url");

/** `value.expiresMs.mac`; values never contain dots (hex addresses and nonces). */
function seal(value: string, ttlSec: number) {
  const body = `${value}.${Date.now() + ttlSec * 1000}`;
  return `${body}.${mac(body)}`;
}

function unseal(token: string | undefined): string | null {
  const parts = token?.split(".");
  if (parts?.length !== 3) return null;
  const [value, expires, sig] = parts as [string, string, string];
  const expected = Buffer.from(mac(`${value}.${expires}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return Number(expires) > Date.now() ? value : null;
}

const cookie = (req: Request, maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: new URL(req.url).protocol === "https:",
  path: "/",
  maxAge,
});

const firstLine = (host: string) => `${host} wants you to sign in to SplitSense with your Sui account:`;

/** Starts a sign-in: the wallet signs this text, bound to a nonce kept in an HttpOnly cookie. */
export async function createChallenge(req: Request, address: string) {
  const nonce = randomBytes(16).toString("hex");
  (await cookies()).set(NONCE_COOKIE, seal(nonce, NONCE_SEC), cookie(req, NONCE_SEC));
  return [
    firstLine(new URL(req.url).host),
    normalizeAddress(address),
    "",
    "Signing proves this wallet is yours. It is free and can't move any funds.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

/** Checks the signed challenge and starts a 30-day session for the address. */
export async function completeSignIn(req: Request, input: { address: string; bytes: string; signature: string }) {
  const jar = await cookies();
  const nonce = unseal(jar.get(NONCE_COOKIE)?.value);
  if (!nonce) throw new AppError("the sign-in request expired; try again", 401);
  const address = normalizeAddress(input.address);
  const bytes = fromBase64(input.bytes);
  const lines = new TextDecoder().decode(bytes).split("\n");
  if (lines[0] !== firstLine(new URL(req.url).host) || lines[1] !== address || !lines.includes(`Nonce: ${nonce}`)) {
    throw new AppError("that isn't the sign-in message we asked for", 401);
  }
  try {
    await verifyPersonalMessageSignature(bytes, input.signature, { address, client: suiClient() });
  } catch {
    throw new AppError("the wallet signature doesn't match this account", 401);
  }
  jar.delete(NONCE_COOKIE);
  jar.set(SESSION_COOKIE, seal(address, SESSION_SEC), cookie(req, SESSION_SEC));
  return address;
}

export async function sessionAddress(): Promise<string | null> {
  return unseal((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<string> {
  const address = await sessionAddress();
  if (!address) throw new AppError("sign in with your wallet first", 401);
  return address;
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
