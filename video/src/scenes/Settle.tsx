import { interpolate, useCurrentFrame } from "remotion";
import { at, mainnet, shortId } from "../data";
import { C, mono } from "../theme";
import { Background, camera, Capture, Captions, Card, Chip, clamp, ease, GlowLine, partial, pop, PopIn, SourceLabel, Title } from "../ui";

const NODES = [
  { word: "builds", label: "Build", by: "Tatum" },
  { word: "simulates", label: "Simulate", by: "Tatum" },
  { word: "wallet signs", label: "Sign", by: "Wallet" },
  { word: "Tatum executes", label: "Execute", by: "Tatum" },
  { word: "Tatum confirms", label: "Confirm", by: "Tatum" },
  { word: "receipt", label: "Receipt", by: "Walrus" },
];
const NY = 290;
const nx = (i: number) => 260 + i * 280;
const TATUM = "#2F6BFF";
const tx = mainnet.settlements.at(-1)!;

export function Settle() {
  const frame = useCurrentFrame();
  const hits = NODES.map((n) => at("settle", n.word));
  const t = interpolate(frame, hits, hits.map((_, i) => i / (hits.length - 1)), clamp);
  const line = partial(
    NODES.map((_, i) => ({ x: nx(i), y: NY })),
    t,
  );
  const confirm = hits[4];
  const checks = at("settle", "checks the payer");
  const three = at("settle", "Three real payments");
  const transfer = ease(frame, hits[0], 14) * (1 - ease(frame, checks - 6, 10));
  const charts = ease(frame, checks - 2, 14) * (1 - ease(frame, three - 6, 12));
  const [from, to] = tx.label.split(",")[0].split(" → ");
  const results = ease(frame, three - 2, 14);

  return (
    <Background>
      <Title kicker="Settling up · through Tatum's Sui Mainnet gateway">A gasless USDC transfer, checked at every step</Title>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={nx(0)} x2={nx(5)} y1={NY} y2={NY} stroke={C.line} strokeWidth={5} />
        <GlowLine d={line.d} width={6} color={TATUM} />
        {frame >= hits[0] && <circle cx={line.head.x} cy={NY} r={12} fill="white" stroke={TATUM} strokeWidth={4} />}
      </svg>
      {NODES.map((n, i) => {
        const p = pop(frame, hits[i]);
        const lit = frame >= hits[i];
        const color = n.by === "Walrus" ? C.teal : n.by === "Wallet" ? C.ink : TATUM;
        return (
          <div key={n.label} style={{ position: "absolute", left: nx(i) - 110, top: NY - 42, width: 220, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                background: lit ? color : "white",
                border: `4px solid ${lit ? "white" : C.line}`,
                boxShadow: lit ? `0 0 0 ${12 * p}px ${color}33, 0 14px 30px rgba(15,29,69,0.2)` : "0 8px 20px rgba(15,29,69,0.08)",
                display: "grid",
                placeItems: "center",
                color: lit ? (n.by === "Walrus" ? C.navy : "white") : C.muted,
                fontSize: 30,
                fontWeight: 800,
                transform: `scale(${lit ? 0.9 + 0.1 * p : 0.9})`,
              }}
            >
              {i + 1}
            </div>
            <div style={{ marginTop: 16, fontSize: 30, fontWeight: 700, opacity: lit ? 1 : 0.45 }}>{n.label}</div>
            <div style={{ marginTop: 2, fontSize: 20, fontWeight: 600, color: lit ? color === C.ink ? C.muted : color === C.teal ? C.tealDeep : TATUM : C.muted, opacity: lit ? 1 : 0.45 }}>{n.by}</div>
          </div>
        );
      })}

      {transfer > 0.01 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 520, display: "flex", justifyContent: "center", opacity: transfer }}>
          <Card style={{ padding: "30px 44px", display: "flex", alignItems: "center", gap: 36 }}>
            <div style={{ fontSize: 40, fontWeight: 700 }}>{from}</div>
            <svg width={220} height={30}>
              <GlowLine d={partial([{ x: 4, y: 15 }, { x: 206, y: 15 }], ease(frame, hits[0] + 6, 30)).d} color={TATUM} width={5} />
            </svg>
            <div style={{ fontSize: 40, fontWeight: 700 }}>{to}</div>
            <div style={{ marginLeft: 20, fontSize: 52, fontWeight: 800, color: TATUM }}>{tx.usdc.toFixed(2)} USDC</div>
            <Chip tone="teal">gasless</Chip>
          </Card>
        </div>
      )}

      {charts > 0.01 && (
        <div style={{ position: "absolute", left: 160, top: 470, width: 1600, opacity: charts }}>
          <div style={{ display: "flex", gap: 28 }}>
            <MiniChart from={checks + 4} title="Payer USDC" delta={tx.payerChange} unit="USDC" color={C.owes} />
            <MiniChart from={at("settle", "the payee gains")} title="Payee USDC" delta={tx.payeeChange} unit="USDC" color={C.tealDeep} />
            <MiniChart from={at("settle", "exactly the agreed")} title="Gas paid" delta={-tx.gasSui} unit="SUI" color={TATUM} />
          </div>
          <div style={{ marginTop: 22, display: "flex", gap: 16, alignItems: "center" }}>
            <Chip style={{ fontFamily: mono, fontSize: 21 }}>
              {tx.digest.slice(0, 7)}…{tx.digest.slice(-3)} · checkpoint {tx.checkpoint.toLocaleString("en-US")} · {tx.status}
            </Chip>
            {frame >= confirm && (
              <PopIn from={confirm}>
                <Chip style={{ fontSize: 21, background: TATUM, color: "white", border: "none" }}>✓ confirmed on Mainnet via Tatum</Chip>
              </PopIn>
            )}
            {frame >= hits[5] && (
              <PopIn from={hits[5]}>
                <Chip tone="teal" style={{ fontSize: 21 }}>
                  receipt on Walrus · <span style={{ fontFamily: mono }}>{shortId(tx.receiptBlobId, 10)}</span>
                </Chip>
              </PopIn>
            )}
          </div>
        </div>
      )}

      {results > 0.01 && (
        <div style={{ position: "absolute", left: 160, top: 470, width: 1600, display: "flex", gap: 36, opacity: results }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 760 }}>
            {mainnet.settlements.map((s, i) => (
              <PopIn key={s.digest} from={three + i * 6}>
                <Card style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ fontSize: 34, fontWeight: 800, width: 180 }}>{s.usdc.toFixed(2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>USDC · {s.status} · {s.gasSui} SUI gas</div>
                    <div style={{ fontFamily: mono, fontSize: 16, color: C.muted, marginTop: 4 }}>
                      checkpoint {s.checkpoint.toLocaleString("en-US")} · receipt {shortId(s.receiptBlobId, 8)}
                    </div>
                  </div>
                </Card>
              </PopIn>
            ))}
          </div>
          <SuiscanShot from={three} />
        </div>
      )}

      <SourceLabel>Source: Sui Mainnet via Tatum · re-read for this video</SourceLabel>
      <Captions id="settle" />
    </Background>
  );
}

function MiniChart({ from, title, delta, unit, color }: { from: number; title: string; delta: number; unit: string; color: string }) {
  const frame = useCurrentFrame();
  const w = 500;
  const h = 150;
  const base = h / 2;
  const step = delta === 0 ? 0 : delta < 0 ? 46 : -46;
  const pts = [
    { x: 0, y: base },
    { x: w * 0.5, y: base },
    { x: w * 0.5, y: base + step },
    { x: w, y: base + step },
  ];
  const line = partial(pts, ease(frame, from, 30));
  return (
    <Card style={{ width: 515, padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.muted }}>{title}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color, opacity: ease(frame, from + 18, 10) }}>
          {delta > 0 ? "+" : delta < 0 ? "−" : ""}
          {Math.abs(delta).toFixed(2)} {unit}
        </div>
      </div>
      <svg width={w - 30} height={h} viewBox={`-10 0 ${w + 20} ${h}`} style={{ marginTop: 6 }}>
        <line x1={0} x2={w} y1={base} y2={base} stroke={C.line} strokeDasharray="4 8" strokeWidth={2} />
        <GlowLine d={line.d} color={color} width={5} />
        <circle cx={line.head.x} cy={line.head.y} r={8} fill={color} stroke="white" strokeWidth={3} />
      </svg>
    </Card>
  );
}

function SuiscanShot({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const box = { x: 0, y: 48, width: 800, height: 380 };
  const rows = { x: 290, y: 518, width: 860, height: 330 };
  const region = camera(frame, [
    { at: 0, region: { x: 200, y: 400, w: 1040 } },
    { at: from + 20, region: { x: 270, y: 480, w: 900 }, dur: 40 },
  ]);
  return (
    <PopIn from={from + 8} style={{ position: "relative", width: 800, height: 430 }}>
      <Capture
        url={`suiscan.xyz/mainnet/tx/${tx.digest.slice(0, 12)}…`}
        box={box}
        region={region}
        layers={[{ shot: "suiscan-tx", opacity: 1 }]}
        rings={[{ rect: { x: rows.x, y: 795, width: 860, height: 40 }, from: from + 40, radius: 10 }]}
      />
    </PopIn>
  );
}
