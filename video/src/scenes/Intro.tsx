import { interpolate, useCurrentFrame } from "remotion";
import { at } from "../data";
import { C } from "../theme";
import { Background, Captions, clamp, ease, GlowLine, Logo, partial, pop } from "../ui";

const STEPS = [
  { word: "learns", title: "Learns", sub: "how the flat actually lives", x: 480 },
  { word: "keeps", title: "Remembers", sub: "Walrus Memory · Sui Mainnet", x: 960 },
  { word: "settles", title: "Settles", sub: "USDC through Tatum · 0 gas", x: 1440 },
];
const Y = 760;

export function Intro() {
  const frame = useCurrentFrame();
  const logo = pop(frame, 0);
  const rise = ease(frame, at("paddock", "It learns") - 6, 24);
  const hits = STEPS.map((s) => at("paddock", s.word));
  const t = interpolate(frame, [hits[0], hits[1], hits[2]], [0, 0.5, 1], clamp);
  const line = partial(
    STEPS.map((s) => ({ x: s.x, y: Y })),
    t,
  );
  const pulse = frame > hits[2] + 10 ? ((frame - hits[2] - 10) % 50) / 50 : -1;

  return (
    <Background dark>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: interpolate(rise, [0, 1], [300, 170]),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${interpolate(rise, [0, 1], [1, 0.82])})`,
        }}
      >
        <div style={{ transform: `scale(${logo})`, filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.35))" }}>
          <Logo size={170} />
        </div>
        <div style={{ marginTop: 34, fontSize: 120, fontWeight: 800, letterSpacing: -4, opacity: ease(frame, 6, 16) }}>Paddock</div>
        <div style={{ marginTop: 6, fontSize: 44, fontWeight: 500, color: "rgba(255,255,255,0.78)", opacity: ease(frame, at("paddock", "shared"), 16) }}>
          Shared bills that remember.
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={STEPS[0].x} x2={STEPS[2].x} y1={Y} y2={Y} stroke="rgba(255,255,255,0.12)" strokeWidth={4} opacity={ease(frame, hits[0] - 8)} />
        <GlowLine d={line.d} width={6} />
        {pulse >= 0 && (
          <circle cx={STEPS[0].x + (STEPS[2].x - STEPS[0].x) * pulse} cy={Y} r={9} fill="white" opacity={Math.sin(pulse * Math.PI)} />
        )}
      </svg>

      {STEPS.map((s, i) => {
        const p = pop(frame, hits[i]);
        const tatum = s.title === "Settles";
        return (
          <div key={s.title} style={{ position: "absolute", left: s.x - 230, top: Y - 34, width: 460, display: "flex", flexDirection: "column", alignItems: "center", opacity: frame < hits[i] ? 0 : 1 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                background: i === 1 ? C.teal : tatum ? "#3B82F6" : "white",
                border: `6px solid ${C.navy}`,
                boxShadow: `0 0 0 ${10 * p}px rgba(79,212,207,0.18)`,
                transform: `scale(${p})`,
              }}
            />
            <div style={{ marginTop: 22, fontSize: 46, fontWeight: 700, transform: `translateY(${(1 - p) * 16}px)` }}>{s.title}</div>
            <div style={{ marginTop: 4, fontSize: 26, color: "rgba(255,255,255,0.72)", transform: `translateY(${(1 - p) * 16}px)` }}>{s.sub}</div>
          </div>
        );
      })}
      <Captions id="paddock" dark />
    </Background>
  );
}
