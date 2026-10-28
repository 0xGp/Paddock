import { describe, expect, it } from "vitest";
import { createTatum, formatCoin, formatUsdc, getBalance, getChainHead, getTransaction, SUI_COIN_TYPE, USDC_MAINNET_COIN_TYPE } from "../src/index.ts";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string>; throws?: Error; delayMs?: number };

function fakeFetch(replies: Reply[]) {
  const calls: { at: number; body: { query: string; variables: Record<string, unknown> }; headers: Record<string, string> }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    calls.push({ at: Date.now(), body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    if (r.delayMs) {
      await new Promise((res, rej) => {
        const t = setTimeout(res, r.delayMs);
        init.signal?.addEventListener("abort", () => (clearTimeout(t), rej(Object.assign(new Error("aborted"), { name: "TimeoutError" }))));
      });
    }
    if (r.throws) throw r.throws;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "x-ttm-plan": "free;ratelimit=3", ...r.headers } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const tatum = (replies: Reply[], extra: Partial<Parameters<typeof createTatum>[0]> = {}) => {
  const f = fakeFetch(replies);
  return { client: createTatum({ url: "https://tatum.test/graphql", apiKey: "k", fetch: f.impl, minIntervalMs: 40, ...extra }), calls: f.calls };
};

describe("createTatum", () => {
  it("sends the key as x-api-key and reports the plan", async () => {
    const { client, calls } = tatum([{ body: { data: { chainIdentifier: "35834a8a", checkpoint: { sequenceNumber: "7", timestamp: null } } } }]);
    const r = await getChainHead(client);
    expect(r).toMatchObject({ ok: true, value: { chainId: "35834a8a", checkpoint: 7 }, plan: "free;ratelimit=3", attempts: 1 });
    expect(calls[0]!.headers["x-api-key"]).toBe("k");
  });

  it("spaces concurrent requests to respect the plan's rate limit", async () => {
    const { client, calls } = tatum([{ body: { data: { chainIdentifier: "x", checkpoint: { sequenceNumber: 1, timestamp: null } } } }], { minIntervalMs: 80 });
    await Promise.all([getChainHead(client), getChainHead(client), getChainHead(client)]);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(60);
  });

  it("retries a 429 and succeeds", async () => {
    const { client, calls } = tatum([{ status: 429, headers: { "retry-after": "0" } }, { body: { data: { chainIdentifier: "x", checkpoint: { sequenceNumber: 1, timestamp: null } } } }]);
    const r = await getChainHead(client);
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it("does not retry GraphQL errors and returns them typed", async () => {
    const { client, calls } = tatum([{ body: { errors: [{ message: "Unknown field" }] } }]);
    const r = await getChainHead(client);
    expect(r).toMatchObject({ ok: false, error: { kind: "graphql", message: "Unknown field" } });
    expect(calls).toHaveLength(1);
  });

  it("gives up after the retry budget on persistent 5xx", async () => {
    const { client, calls } = tatum([{ status: 503 }], { retries: 1 });
    const r = await getChainHead(client);
    expect(r).toMatchObject({ ok: false, error: { kind: "http", status: 503 }, attempts: 2 });
    expect(calls).toHaveLength(2);
  });

  it("exposes a rate-limited fetch that shares the queue and retries 429", async () => {
    const { client, calls } = tatum([{ status: 429, headers: { "retry-after": "0" } }, { body: { data: { ok: 1 } } }], { minIntervalMs: 80 });
    const [a, b] = await Promise.all([client.fetch("https://tatum.test/graphql", { method: "POST", body: JSON.stringify({ query: "{a}" }) }), client.fetch("https://tatum.test/graphql", { method: "POST", body: JSON.stringify({ query: "{b}" }) })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(calls).toHaveLength(3);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i]!.at);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(60);
  });

  it("maps a slow gateway to a timeout", async () => {
    const { client } = tatum([{ delayMs: 200 }], { timeoutMs: 30, retries: 0 });
    expect(await getChainHead(client)).toMatchObject({ ok: false, error: { kind: "timeout" } });
  });
});

describe("reads", () => {
  it("parses a transaction's balance changes as bigints", async () => {
    const { client, calls } = tatum([
      {
        body: {
          data: {
            transaction: {
              digest: "D",
              effects: {
                status: "SUCCESS",
                timestamp: "2026-10-28T17:00:00Z",
                checkpoint: { sequenceNumber: "339121121" },
                balanceChanges: { nodes: [{ amount: "-11", owner: { address: "0xa" }, coinType: { repr: "U" } }, { amount: "11", owner: { address: "0xb" }, coinType: { repr: "U" } }] },
              },
            },
          },
        },
      },
    ]);
    const r = await getTransaction(client, "D");
    expect(r.ok && r.value).toEqual({ digest: "D", status: "SUCCESS", checkpoint: 339121121, timestamp: "2026-10-28T17:00:00Z", balanceChanges: [{ owner: "0xa", coinType: "U", amount: -11n }, { owner: "0xb", coinType: "U", amount: 11n }] });
    expect(calls[0]!.body.variables).toEqual({ digest: "D" });
  });

  it("reports an unknown digest as not_found", async () => {
    const { client } = tatum([{ body: { data: { transaction: null } } }]);
    expect(await getTransaction(client, "nope")).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("reads a balance, treating a missing coin as zero", async () => {
    const { client } = tatum([{ body: { data: { address: { balance: { totalBalance: "2500000" } } } } }, { body: { data: { address: { balance: null } } } }]);
    expect(await getBalance(client, "0xa", "U")).toMatchObject({ ok: true, value: 2_500_000n });
    expect(await getBalance(client, "0xa", "U")).toMatchObject({ ok: true, value: 0n });
  });

  it("formats USDC micro-units", () => {
    expect(formatUsdc(2_500_000n)).toBe("2.50");
    expect(formatUsdc(1_234_567_890n)).toBe("1,234.56");
    expect(formatUsdc(-11n, 6)).toBe("-0.000011");
  });

  it("formats known coins without trailing zeros", () => {
    expect(formatCoin(-11n, USDC_MAINNET_COIN_TYPE)).toBe("-0.000011 USDC");
    expect(formatCoin(10_000n, USDC_MAINNET_COIN_TYPE)).toBe("0.01 USDC");
    expect(formatCoin(2_000_000n, USDC_MAINNET_COIN_TYPE)).toBe("2 USDC");
    expect(formatCoin(-100_000n, SUI_COIN_TYPE)).toBe("-0.0001 SUI");
    expect(formatCoin(5n, "0xabc::foo::FOO")).toBe("5 FOO");
  });
});
