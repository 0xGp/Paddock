"use client";

import { HandCoins, Link2, Plus, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { AddressMark } from "@/components/wallet/connect";
import { cn } from "@/lib/cn";
import { shortAddress, suiAmount, usdcAmount } from "@/lib/format";
import { useActivity, useBalances, type Balances } from "./_components/data";
import { GroupRow } from "./_components/groups";
import { PaymentRow } from "./_components/payment";
import { EmptyState, Panel, useAccess } from "./_components/shell";

export default function HomeScreen() {
  const { me, address } = useAccess();
  const balances = useBalances(address);
  const activity = useActivity(address);
  const groups = me.data?.groups ?? [];
  const owing = groups.reduce((s, g) => s + g.owe.reduce((t, d) => t + BigInt(d.microUsdc), 0n), 0n);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
      <WalletCard
        address={address!}
        name={me.data?.profile.name ?? ""}
        data={balances.data}
        error={balances.error}
        loading={balances.loading}
        onRefresh={balances.reload}
        owing={owing}
      />

      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Panel
          title="Your groups"
          action={
            groups.length > 0 && (
              <Link href="/app/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy px-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.97]">
                <Plus aria-hidden className="size-4" />
                New
              </Link>
            )
          }
        >
          {groups.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No groups yet"
              body="Start a flat for bills at home, or an event for a trip or a party. Then send your friends the invite link."
            >
              <Link href="/app/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white">
                <Plus aria-hidden className="size-4" />
                Create a group
              </Link>
              <Link href="/demo" className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
                See the demo flat
              </Link>
            </EmptyState>
          ) : (
            <div className="space-y-0.5">
              {groups.map((g) => (
                <GroupRow key={g.id} g={g} />
              ))}
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 px-4 pt-1 pb-3 text-xs text-ink-muted">
            <Link2 aria-hidden className="size-3.5" />
            Got an invite link? Open it and you&apos;ll join from there.
          </p>
        </Panel>
      </div>

      {activity.data && activity.data.payments.length > 0 && (
        <Panel
          title="Recent payments"
          action={
            <Link href="/app/activity" className="text-sm font-semibold text-sui">
              See all
            </Link>
          }
        >
          <div className="space-y-0.5">
            {activity.data.payments.slice(0, 4).map((p) => (
              <PaymentRow key={p.digest} p={p} me={p.me} group={p.groupName} expandable={false} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function WalletCard({
  address,
  name,
  data,
  error,
  loading,
  onRefresh,
  owing,
}: {
  address: string;
  name: string;
  data: Balances | undefined;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  owing: bigint;
}) {
  const b = data?.balances;
  return (
    <section aria-labelledby="wallet-balance" className="hero-card rounded-[2rem] p-6 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <AddressMark address={address} className="size-8 ring-white/30" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name ? `Hi, ${name}` : "Your wallet"}</p>
            <p className="font-mono text-xs text-white/65">{shortAddress(address)}</p>
          </div>
        </div>
        <button type="button" onClick={onRefresh} aria-label="Refresh balance" className="grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-md hover:bg-white/15">
          <RefreshCw aria-hidden className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      <h2 id="wallet-balance" className="sr-only">
        Wallet balance
      </h2>
      <div className="mt-8 min-h-[4.75rem]">
        {b?.ok ? (
          <>
            <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
              {usdcAmount(BigInt(b.usdcMicro))}
              <span className="ml-2 text-xl font-semibold text-white/70 sm:text-2xl">USDC</span>
            </p>
            <p className="mt-1.5 text-sm text-white/70 tabular-nums">{suiAmount(BigInt(b.suiMist))} SUI for gas, not needed to settle</p>
          </>
        ) : b && !b.ok ? (
          <p className="text-sm text-white/80">Couldn&apos;t read your balance from Sui just now. Try refresh.</p>
        ) : error ? (
          <p className="text-sm text-white/80">{error}</p>
        ) : (
          <div aria-hidden className="space-y-3">
            <div className="h-11 w-48 animate-pulse rounded-xl bg-white/15" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-white/10" />
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/app/settle"
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-navy transition-transform active:scale-[0.97]",
            owing === 0n && "pointer-events-none opacity-50",
          )}
          aria-disabled={owing === 0n}
        >
          <HandCoins aria-hidden className="size-4" />
          {owing > 0n ? `Settle ${usdcAmount(owing)} USDC` : "Settle up"}
        </Link>
        <Link
          href="/app/new"
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 text-sm font-semibold backdrop-blur-md transition-transform active:scale-[0.97]"
        >
          <Plus aria-hidden className="size-4" />
          New group
        </Link>
      </div>

      {b && <p className="mt-4 text-center text-[0.6875rem] text-white/55">Read from Sui Mainnet through Tatum in {b.ms} ms</p>}
    </section>
  );
}
