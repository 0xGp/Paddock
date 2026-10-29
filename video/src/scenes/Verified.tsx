import { interpolate, random, useCurrentFrame } from "remotion";
import { at, mainnet } from "../data";
import { C, mono } from "../theme";
import { Background, Captions, Card, Chip, clamp, ease, GlowLine, pop, PopIn, SourceLabel, Title } from "../ui";

const Y = 450;
const LEFT = 200;
const RIGHT = 1720;
const W = 300;
const cps = mainnet.ledger.checkpoints;
const xs = cps.map((_, i) => 260 + W / 2 + i * ((1660 - 260 - W) / (cps.length - 1)));

export function Verified() {
  const frame = useCurrentFrame();
  const drop = at("verified", "four checkpoints");
  const runFrom = at("verified", "matches all");
  const runTo = at("verified", "hash for hash");
  const ns = at("verified", "Namespaces are hashed");
  const seal = at("verified", "SEAL-encrypted");
  const lineX = interpolate(frame, [runFrom, runTo], [LEFT, RIGHT], clamp);

  const target = mainnet.namespace;
  const settled = interpolate(frame, [ns + 4, ns + 34], [0, target.length], clamp);
  const chars = "abcdef0123456789";
  const scrambled = [...target].map((c, i) => (i < settled || c === "_" ? c : chars[Math.floor(random(`${i}-${Math.floor(frame / 2)}`) * chars.length)])).join("");

  return (
    <Background>
      <Title kicker="Verified · tamper-evident">The ledger, rebuilt from Walrus</Title>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={LEFT} x2={RIGHT} y1={Y} y2={Y} stroke={C.line} strokeWidth={4} opacity={ease(frame, drop)} />
        {frame >= runFrom && <GlowLine d={`M${LEFT},${Y} L${lineX},${Y}`} width={6} color={C.tealDeep} />}
      </svg>
      {cps.map((cp, i) => {
        const from = i ? cps[i - 1].entryCount + 1 : 1;
        const p = pop(frame, drop + i * 5);
        const ok = lineX >= xs[i];
        return (
          <div key={cp.blobId} style={{ position: "absolute", left: xs[i] - W / 2, top: Y - 85, width: W, opacity: frame < drop ? 0 : 1, transform: `translateY(${(1 - p) * -60}px)` }}>
            <Card style={{ padding: 24, height: 170, boxSizing: "border-box", border: ok ? `3px solid ${C.teal}` : "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  entries {from}–{cp.entryCount}
                </div>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    display: "grid",
                    placeItems: "center",
                    background: ok ? C.teal : "rgba(27,35,64,0.08)",
                    color: C.navy,
                    fontWeight: 800,
                    fontSize: 24,
                    transform: `rotateY(${ok ? 0 : 180}deg)`,
                  }}
                >
                  {ok ? "✓" : ""}
                </div>
              </div>
              <div style={{ fontFamily: mono, fontSize: 16, color: C.muted, marginTop: 20 }}>hash {cp.ledgerHash.slice(0, 16)}…</div>
              <div style={{ fontFamily: mono, fontSize: 16, color: C.tealDeep, marginTop: 8 }}>blob {cp.blobId.slice(0, 14)}…</div>
            </Card>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center" }}>
        <PopIn from={runTo}>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1.5 }}>
            {mainnet.ledger.verifiedEntries} / {mainnet.ledger.totalEntries} <span style={{ color: C.muted, fontWeight: 600, fontSize: 40 }}>matched, hash for hash</span>
          </div>
        </PopIn>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 770, display: "flex", justifyContent: "center", gap: 18, alignItems: "center" }}>
        {frame >= ns && (
          <PopIn from={ns}>
            <Chip style={{ fontFamily: mono, fontSize: 28, padding: "14px 26px" }}>🔒 {scrambled}</Chip>
          </PopIn>
        )}
        {frame >= seal && (
          <PopIn from={seal}>
            <Chip style={{ background: C.navy, color: "white", fontSize: 26, padding: "14px 26px" }}>SEAL encrypted · no names on-chain</Chip>
          </PopIn>
        )}
      </div>
      <SourceLabel>Source: Walrus Mainnet · {cps.length} ledger checkpoints</SourceLabel>
      <Captions id="verified" />
    </Background>
  );
}
