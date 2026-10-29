import { interpolate, useCurrentFrame } from "remotion";
import { at, mainnet } from "../data";
import { C, mono } from "../theme";
import { Background, Captions, Chip, clamp, ease, GlowLine, Logo, partial, PopIn } from "../ui";

const LEFT = 220;
const RIGHT = 1180;
const BOTTOM = 820;
const TOP = 260;
const MAX = 80;
const yOf = (v: number) => BOTTOM - (v / MAX) * (BOTTOM - TOP);

export function Close() {
  const frame = useCurrentFrame();
  const total = mainnet.mainnet.memories;
  const gate = mainnet.mainnet.gate;
  const drawTo = at("close", "Three gasless");
  const t = interpolate(frame, [4, drawTo], [0, 1], { ...clamp, easing: (x) => 1 - (1 - x) ** 2 });
  const pts = Array.from({ length: 40 }, (_, i) => {
    const k = i / 39;
    return { x: LEFT + k * (RIGHT - LEFT), y: yOf(total * (k ** 1.6)) };
  });
  const line = partial(pts, t);
  const count = Math.round(total * (((line.head.x - LEFT) / (RIGHT - LEFT)) ** 1.6));
  const crossed = count >= gate;
  const end = at("close", "Paddock.");
  const card = ease(frame, end - 4, 18);

  return (
    <Background dark>
      <div style={{ opacity: 1 - card }}>
        <div style={{ position: "absolute", left: LEFT, top: 120, fontFamily: mono, fontSize: 20, letterSpacing: 2, color: C.teal }}>MEMORIES ON WALRUS MAINNET</div>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <line x1={LEFT} x2={RIGHT + 60} y1={BOTTOM} y2={BOTTOM} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
          <line x1={LEFT} x2={RIGHT + 60} y1={yOf(gate)} y2={yOf(gate)} stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeDasharray="10 10" />
          <text x={RIGHT + 60} y={yOf(gate) - 14} fill="rgba(255,255,255,0.7)" fontSize={22} textAnchor="end" fontFamily={mono}>
            {gate} required
          </text>
          <GlowLine d={line.d} width={6} />
          <circle cx={line.head.x} cy={line.head.y} r={11} fill={C.teal} stroke={C.navy} strokeWidth={4} />
        </svg>
        <div style={{ position: "absolute", left: line.head.x + 26, top: line.head.y - 50, fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
          {count}
          {crossed && <div style={{ fontSize: 24, fontWeight: 600, color: C.teal, letterSpacing: 0, marginTop: 8 }}>✓ above the {gate} required</div>}
        </div>
        <div style={{ position: "absolute", left: 1400, top: 470, display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { from: at("close", "Three gasless"), text: `${mainnet.recall.verified} verified · ${mainnet.recall.rejected} rejected` },
            { from: at("close", "Three gasless") + 8, text: `${mainnet.ledger.verifiedEntries} / ${mainnet.ledger.totalEntries} ledger entries` },
            { from: at("close", "Three gasless") + 16, text: `${mainnet.settlements.length} payments · ${mainnet.settlements.reduce((n, s) => n + s.gasSui, 0)} gas` },
          ].map((c) =>
            frame >= c.from ? (
              <PopIn key={c.text} from={c.from}>
                <Chip tone="dark" style={{ fontSize: 30, padding: "16px 28px" }}>
                  {c.text}
                </Chip>
              </PopIn>
            ) : null,
          )}
        </div>
      </div>

      {card > 0.01 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: card, transform: `scale(${0.96 + 0.04 * card})` }}>
          <Logo size={150} />
          <div style={{ marginTop: 26, fontSize: 110, fontWeight: 800, letterSpacing: -4 }}>Paddock</div>
          <div style={{ marginTop: 4, fontSize: 40, color: "rgba(255,255,255,0.75)" }}>Shared bills that remember.</div>
          <div style={{ marginTop: 50, display: "flex", gap: 20 }}>
            <Chip style={{ fontSize: 34, padding: "16px 30px", background: C.teal, color: C.navy, border: "none" }}>usepaddock.online</Chip>
            <Chip tone="dark" style={{ fontSize: 30, padding: "16px 30px", fontFamily: mono }}>
              github.com/0xGp/Paddock
            </Chip>
          </div>
          <div style={{ marginTop: 44, fontSize: 24, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>Built with Tatum × Walrus · Sui Mainnet</div>
        </div>
      )}
      <Captions id="close" dark />
    </Background>
  );
}
