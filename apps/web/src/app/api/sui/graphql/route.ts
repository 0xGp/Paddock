import { z } from "zod";
import { tatum } from "@/server/tatum";

const MAX_BODY = 64 * 1024;

const body = z.object({
  query: z.string().min(1).max(16_000),
  variables: z.record(z.string(), z.unknown()).optional(),
  operationName: z.string().max(200).nullish(),
});

const STATUS = { rate_limited: 429, timeout: 504, network: 502, http: 502, parse: 502 } as const;

/**
 * Sui GraphQL for the browser, through Tatum. The wallet builds and executes transactions against
 * this endpoint so every chain call goes through Tatum while the key stays on the server.
 */
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") return Response.json({ errors: [{ message: "cross-site requests are not allowed" }] }, { status: 403 });
  const text = await req.text();
  if (text.length > MAX_BODY) return Response.json({ errors: [{ message: "request too large" }] }, { status: 413 });

  let parsed: z.infer<typeof body>;
  try {
    parsed = body.parse(JSON.parse(text));
  } catch {
    return Response.json({ errors: [{ message: "expected a GraphQL request body" }] }, { status: 400 });
  }

  const r = await tatum().request<unknown>(parsed.query, parsed.variables ?? {});
  if (r.ok) return Response.json({ data: r.value });
  if (r.error.kind === "graphql") return Response.json({ errors: [{ message: r.error.message }] });
  const status = STATUS[r.error.kind as keyof typeof STATUS] ?? 502;
  return Response.json({ errors: [{ message: `Tatum ${r.error.kind}: ${r.error.message}` }] }, { status });
}
