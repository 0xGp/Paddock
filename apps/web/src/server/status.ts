import "server-only";
import { MemWal } from "@mysten-incubation/memwal";
import { formatCoin, getBalance, getChainHead, getTransaction, QUERIES, SUI_MAINNET_CHAIN_ID, type Result } from "@splitsense/chain";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/env";
import { shortId, suiscanAccount, suiscanCheckpoint, suiscanTx } from "@/lib/format";
import { demoNamespace } from "@/server/memory";
import { tatum } from "@/server/tatum";

export const STATUS_TAG = "status";

export interface Fact {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}

export interface StatusCheck {
  id: string;
  service: "tatum" | "walrus";
  title: string;
  /** What actually ran: a GraphQL document for Tatum, an SDK call for Walrus. */
  call: string;
  variables: Record<string, string> | null;
  ok: boolean;
  ms: number;
  attempts: number;
  error: string | null;
  facts: Fact[];
}

export interface StatusReport {
  checkedAt: string;
  endpoint: string;
  plan: string | null;
  checks: StatusCheck[];
}

const ago = (fromIso: string, toIso: string) => {
  const s = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  return s < 120 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
};

function tatumCheck<T>(id: string, title: string, call: string, variables: Record<string, string> | null, r: Result<T>, facts: (v: T) => Fact[]): StatusCheck {
  return {
    id,
    service: "tatum",
    title,
    call,
    variables,
    ok: r.ok,
    ms: r.ms,
    attempts: r.attempts,
    error: r.ok ? null : `${r.error.kind}: ${r.error.message}`,
    facts: r.ok ? facts(r.value) : [],
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T; ms: number } | { ok: false; error: string; ms: number }> {
  const started = Date.now();
  try {
    return { ok: true, value: await fn(), ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e), ms: Date.now() - started };
  }
}

async function tatumChecks(checkedAt: string): Promise<{ checks: StatusCheck[]; plan: string | null }> {
  const client = tatum();
  const digest = env.STATUS_KNOWN_DIGEST;
  const [head, tx] = await Promise.all([getChainHead(client), getTransaction(client, digest)]);

  const usdcIn = tx.ok ? tx.value.balanceChanges.find((b) => b.coinType === env.USDC_COIN_TYPE && b.amount > 0n) : undefined;
  const holder = usdcIn?.owner ?? null;
  const balance = holder ? await getBalance(client, holder, env.USDC_COIN_TYPE) : null;

  const checks = [
    tatumCheck("chain", "Chain and latest checkpoint", QUERIES.chainHead, null, head, (v) => {
      const mainnet = v.chainId === SUI_MAINNET_CHAIN_ID;
      return [
        { label: "Network", value: mainnet ? "Sui Mainnet" : "Not Mainnet" },
        { label: "Chain ID", value: shortId(v.chainId), mono: true },
        { label: "Checkpoint", value: v.checkpoint.toLocaleString("en-NG"), href: suiscanCheckpoint(v.checkpoint), mono: true },
        ...(v.timestamp ? [{ label: "Sealed", value: ago(v.timestamp, checkedAt) }] : []),
      ];
    }),
    tatumCheck("tx", "Our first settlement's balance changes", QUERIES.transaction, { digest }, tx, (v) => [
      { label: "Digest", value: shortId(v.digest), href: suiscanTx(v.digest), mono: true },
      { label: "Status", value: v.status === "SUCCESS" ? "Success" : v.status },
      ...(v.checkpoint !== null ? [{ label: "Checkpoint", value: v.checkpoint.toLocaleString("en-NG"), mono: true }] : []),
      ...v.balanceChanges.map((b) => ({ label: b.owner ? shortId(b.owner) : "Shared object", value: formatCoin(b.amount, b.coinType), href: b.owner ? suiscanAccount(b.owner) : undefined, mono: true })),
    ]),
  ];
  if (!tx.ok) {
    checks.push({ id: "balance", service: "tatum", title: "USDC balance", call: QUERIES.balance, variables: null, ok: false, ms: 0, attempts: 0, error: "skipped: needs the transaction above", facts: [] });
  } else if (!holder || !balance) {
    checks.push({ id: "balance", service: "tatum", title: "USDC balance", call: QUERIES.balance, variables: null, ok: false, ms: 0, attempts: 0, error: "skipped: that transaction sent no USDC", facts: [] });
  } else {
    checks.push(
      tatumCheck("balance", "USDC balance of the payee", QUERIES.balance, { address: holder, coinType: env.USDC_COIN_TYPE }, balance, (v) => [
        { label: "Address", value: shortId(holder), href: suiscanAccount(holder), mono: true },
        { label: "Balance", value: formatCoin(v, env.USDC_COIN_TYPE) },
      ]),
    );
  }
  const plan = [head, tx, balance].find((r) => r?.plan)?.plan ?? null;
  return { checks, plan };
}

async function walrusChecks(): Promise<StatusCheck[]> {
  const client = MemWal.create({ key: env.MEMWAL_PRIVATE_KEY, accountId: env.MEMWAL_ACCOUNT_ID, serverUrl: env.MEMWAL_SERVER_URL, requestTimeoutMs: 10_000 });
  try {
    const ns = demoNamespace();
    const [health, spaces] = await Promise.all([timed(() => client.health()), timed(() => client.listNamespaces())]);
    const flat = spaces.ok ? spaces.value.namespaces.find((n) => n.name === ns) : undefined;
    return [
      {
        id: "relayer",
        service: "walrus",
        title: "Memory relayer health",
        call: "memwal.health()",
        variables: null,
        ok: health.ok && health.value.status === "ok" && health.value.write_ready !== false,
        ms: health.ms,
        attempts: 1,
        error: health.ok ? (health.value.status === "ok" ? (health.value.write_ready === false ? "relayer reports writes not ready" : null) : `status ${health.value.status}`) : health.error,
        facts: health.ok
          ? [
              { label: "Status", value: health.value.status === "ok" ? "OK" : health.value.status },
              { label: "Writes", value: health.value.write_ready === false ? "Not ready" : health.value.write_ready ? "Ready" : "Not reported" },
              { label: "Version", value: health.value.version, mono: true },
            ]
          : [],
      },
      {
        id: "memories",
        service: "walrus",
        title: "Memories stored for the demo flat",
        call: "memwal.listNamespaces()",
        variables: null,
        ok: spaces.ok && !!flat,
        ms: spaces.ms,
        attempts: 1,
        error: spaces.ok ? (flat ? null : `namespace ${ns} not found`) : spaces.error,
        facts: flat
          ? [
              { label: "Namespace", value: ns, mono: true },
              { label: "Memories", value: flat.memory_count.toLocaleString("en-NG") },
            ]
          : [],
      },
    ];
  } finally {
    client.destroy();
  }
}

/**
 * Live checks against Tatum's Sui GraphQL gateway and the Walrus memory relayer. Cached for 30 s,
 * so however busy the page gets it costs at most three Tatum requests per half minute.
 */
export async function getStatus(): Promise<StatusReport> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 3600 });
  cacheTag(STATUS_TAG);

  const checkedAt = new Date().toISOString();
  const [tatumResult, walrus] = await Promise.all([tatumChecks(checkedAt), walrusChecks()]);
  return { checkedAt, endpoint: new URL(env.TATUM_SUI_GRAPHQL_URL).host, plan: tatumResult.plan, checks: [...tatumResult.checks, ...walrus] };
}
