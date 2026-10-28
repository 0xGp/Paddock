export type ChainErrorKind = "http" | "graphql" | "timeout" | "network" | "rate_limited" | "not_found" | "parse" | "mismatch";

export interface ChainError {
  kind: ChainErrorKind;
  message: string;
  status?: number;
}

export interface CallMeta {
  /** Wall time including queueing and retries. */
  ms: number;
  attempts: number;
  /** Tatum's `x-ttm-plan` header, e.g. `free;ratelimit=3;strategy=shared`. */
  plan: string | null;
}

export type Result<T> = ({ ok: true; value: T } | { ok: false; error: ChainError }) & CallMeta;

export interface TatumOptions {
  url: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Minimum gap between request starts. The free plan allows 3 requests/second. */
  minIntervalMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (e: ChainError) => e.kind === "rate_limited" || e.kind === "network" || e.kind === "timeout" || (e.kind === "http" && (e.status ?? 0) >= 500);

/** Tatum's Sui GraphQL gateway (ADR-0004): one serialized queue, timeouts, retries with jitter, typed results. */
export function createTatum(opts: TatumOptions) {
  const { url, apiKey, timeoutMs = 8000, minIntervalMs = 350, retries = 2 } = opts;
  const doFetch = opts.fetch ?? fetch;
  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = 0;

  async function once<T>(query: string, variables: Record<string, unknown>): Promise<{ ok: true; data: T; plan: string | null } | { ok: false; error: ChainError; plan: string | null; retryAfterMs?: number }> {
    const wait = lastStart + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = (e as Error)?.name;
      return { ok: false, plan: null, error: name === "TimeoutError" || name === "AbortError" ? { kind: "timeout", message: `no answer in ${timeoutMs} ms` } : { kind: "network", message: (e as Error)?.message ?? String(e) } };
    }
    const plan = res.headers.get("x-ttm-plan");
    if (res.status === 429) {
      const after = Number(res.headers.get("retry-after"));
      return { ok: false, plan, error: { kind: "rate_limited", message: "Tatum rate limit (429)", status: 429 }, ...(Number.isFinite(after) && after > 0 ? { retryAfterMs: after * 1000 } : {}) };
    }
    if (!res.ok) return { ok: false, plan, error: { kind: "http", message: `HTTP ${res.status}`, status: res.status } };
    let body: { data?: T; errors?: { message: string }[] };
    try {
      body = await res.json();
    } catch {
      return { ok: false, plan, error: { kind: "parse", message: "response was not JSON" } };
    }
    if (body.errors?.length) return { ok: false, plan, error: { kind: "graphql", message: body.errors.map((e) => e.message).join("; ").slice(0, 300) } };
    if (body.data === undefined) return { ok: false, plan, error: { kind: "parse", message: "no data in response" } };
    return { ok: true, data: body.data, plan };
  }

  /** Runs one GraphQL request through the shared queue. Never throws. */
  function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<Result<T>> {
    const run = async (): Promise<Result<T>> => {
      const started = Date.now();
      let attempts = 0;
      for (;;) {
        attempts++;
        const r = await once<T>(query, variables);
        if (r.ok) return { ok: true, value: r.data, ms: Date.now() - started, attempts, plan: r.plan };
        if (attempts > retries || !retryable(r.error)) return { ok: false, error: r.error, ms: Date.now() - started, attempts, plan: r.plan };
        await sleep(r.retryAfterMs ?? 400 * 2 ** (attempts - 1) + Math.random() * 200);
      }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  }

  /**
   * A `fetch` that shares the queue and retries 429/5xx, for clients that batch their own requests
   * (the Sui SDK resolves a transaction with parallel GraphQL calls). Re-sending a signed
   * transaction is safe: Sui executes a digest at most once.
   */
  function limitedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const run = async (): Promise<Response> => {
      for (let attempt = 1; ; attempt++) {
        const wait = lastStart + minIntervalMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastStart = Date.now();
        const res = await doFetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) });
        if ((res.status !== 429 && res.status < 500) || attempt > retries) return res;
        const after = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 400 * 2 ** (attempt - 1) + Math.random() * 200);
      }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  }

  return { request, fetch: limitedFetch };
}

export type Tatum = ReturnType<typeof createTatum>;
