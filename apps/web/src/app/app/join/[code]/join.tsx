"use client";

import { ArrowRight, Link2Off, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { refreshAll, send, useJson, type GroupKind } from "../../_components/data";
import { Faces, KIND, KindIcon } from "../../_components/groups";
import { AccessGate, EmptyState, Panel, useAccess } from "../../_components/shell";

interface Invite {
  id: string;
  name: string;
  kind: GroupKind;
  place: string | null;
  members: string[];
}

export function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const invite = useJson<Invite>(`/api/invites/${code}`);

  if (!invite.data && invite.error)
    return (
      <Panel className="mx-auto mt-6 max-w-md">
        <EmptyState icon={<Link2Off className="size-6" />} title="This invite doesn't work" body={invite.error}>
          <Link href="/app" className="glass inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold">
            Go to Paddock
          </Link>
        </EmptyState>
      </Panel>
    );
  if (!invite.data) return <div className="glass mx-auto mt-6 h-96 max-w-md animate-pulse rounded-[2rem]" />;

  const card = <InviteCard invite={invite.data} />;
  return (
    <AccessGate intro={card} reason={`Connect the wallet you'll pay and get paid with. It's your Paddock account, so there's no password.`}>
      <div className="mx-auto mt-2 max-w-md space-y-4 sm:mt-10">
        {card}
        <JoinAction code={code} invite={invite.data} />
      </div>
    </AccessGate>
  );
}

function InviteCard({ invite }: { invite: Invite }) {
  const n = invite.members.length;
  return (
    <section className="hero-card rounded-[2rem] p-6 text-white">
      <p className="text-sm text-white/70">You&apos;re invited to {invite.kind === "flat" ? "a flat" : "an event"}</p>
      <div className="mt-3 flex items-center gap-3">
        <KindIcon kind={invite.kind} className="bg-white/15 text-white ring-1 ring-white/25" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{invite.name}</h1>
          {invite.place && <p className="truncate text-sm text-white/70">{invite.place}</p>}
        </div>
      </div>
      <p className="mt-5 flex items-center gap-2 text-sm text-white/80">
        <Faces names={invite.members} max={5} />
        {n <= 3 ? invite.members.join(", ") : `${invite.members.slice(0, 2).join(", ")} and ${n - 2} more`} {n === 1 ? "is" : "are"} in
      </p>
    </section>
  );
}

function JoinAction({ code, invite }: { code: string; invite: Invite }) {
  const router = useRouter();
  const { me } = useAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = me.data?.groups.some((g) => g.id === invite.id);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await send<{ id: string }>(`/api/invites/${code}`, "POST");
      refreshAll();
      router.push(`/app/g/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className="p-3 text-center">
        <p className="text-sm text-pretty text-ink-muted">
          {already
            ? `You're already in ${invite.name}.`
            : `You'll join as ${me.data?.profile.name}. Your ${KIND[invite.kind].noun} will see your name and wallet address so they can settle with you.`}
        </p>
        {already ? (
          <Link href={`/app/g/${invite.id}`} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white">
            Open {invite.name}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            Join {invite.name}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-owes/[0.08] px-4 py-3 text-sm text-owes">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
