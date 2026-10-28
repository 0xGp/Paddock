import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

export const suiAddress = z.string().regex(/^0x[0-9a-fA-F]{1,64}$/, "not a Sui address");

/** A failure the user should see, with the HTTP status that goes with it. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** JSON with bigints as decimal strings. */
export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)), {
    ...init,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...init?.headers },
  });

export const fail = (message: string, status = 400) => json({ error: message }, { status });

export const crossSite = (req: Request) => req.headers.get("sec-fetch-site") === "cross-site";

/** Runs a handler, turning `AppError`s into their status and anything else into a logged 500. */
export async function handle(run: () => Promise<unknown>) {
  try {
    return json(await run());
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return fail(e.message, e.status);
    console.error(e);
    return fail("something went wrong on our side", 500);
  }
}

/** Parses a JSON body or throws a 400 naming what was expected. */
export async function body<T extends z.ZodType>(req: Request, schema: T, expected: string): Promise<z.infer<T>> {
  if (crossSite(req)) throw new AppError("cross-site requests are not allowed", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError(`expected ${expected}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  return parsed.data;
}
