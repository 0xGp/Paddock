import { interpolate, useCurrentFrame } from "remotion";
import { at, captures, terminal } from "../data";
import { C, mono } from "../theme";
import { Background, camera, Capture, Captions, Card, Chip, clamp, ease, GlowLine, partial, PopIn } from "../ui";

const status = captures.shots.status;

export function Check() {
  const frame = useCurrentFrame();
  const calls = at("check", "The status page");
  const behind = at("check", "Behind it");
  const region = camera(frame, [
    { at: 0, region: { x: 0, y: 0, w: 1440 } },
    { at: calls, region: { x: 0, y: status.height - 1440 * (852 / 1600), w: 1440 }, dur: behind - calls - 10 },
  ]);
  const term = ease(frame, behind - 4, 14);
  const chips = [
    { word: "strict TypeScript", text: "strict TypeScript" },
    { word: "eighty-eight unit tests", text: `${terminal.unitTests} unit tests passing` },
    { word: "live Tatum tests", text: "live Tatum tests" },
    { word: "twelve decision records", text: "12 decision records" },
  ];

  return (
    <Background>
      <Capture url="usepaddock.online/status" region={region} layers={[{ shot: "status", opacity: 1 }]} opacity={1 - 0.6 * term} />
      <div style={{ position: "absolute", right: 120, top: 14 }}>
        <PopIn from={calls + 10}>
          <Chip>
            <span style={{ color: C.tealDeep }}>●</span> Live Tatum calls · Sui Mainnet
          </Chip>
        </PopIn>
      </div>
      {frame >= calls + 20 && <Latency from={calls + 20} opacity={1 - term} />}
      {term > 0.01 && <Terminal from={behind} opacity={term} />}
      <div style={{ position: "absolute", right: 160, top: 220, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end" }}>
        {chips.map((c) => {
          const from = at("check", c.word);
          return frame >= from ? (
            <PopIn key={c.text} from={from}>
              <Chip tone="teal" style={{ fontSize: 28, padding: "14px 24px", background: "white" }}>
                ✓ {c.text}
              </Chip>
            </PopIn>
          ) : null;
        })}
      </div>
      <Captions id="check" />
    </Background>
  );
}

function Latency({ from, opacity }: { from: number; opacity: number }) {
  const frame = useCurrentFrame();
  const values = status.latenciesMs as number[];
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const w = 420;
  const h = 110;
  const pts = values.map((v, i) => ({ x: (i * w) / (values.length - 1), y: h - (v / max) * (h - 12) }));
  const line = partial(pts, ease(frame, from, 30));
  return (
    <div style={{ position: "absolute", left: 200, bottom: 150, opacity }}>
      <PopIn from={from}>
        <Card style={{ padding: 24, width: 480 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: C.muted }}>Tatum latency in this capture</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>
            {Math.min(...values)}–{max} ms
          </div>
          <svg width={w + 20} height={h + 16} viewBox={`-10 -8 ${w + 20} ${h + 16}`} style={{ marginTop: 10 }}>
            <GlowLine d={line.d} width={4} color={C.blue} />
            <circle cx={line.head.x} cy={line.head.y} r={6} fill={C.blue} stroke="white" strokeWidth={2} />
          </svg>
        </Card>
      </PopIn>
    </div>
  );
}

function Terminal({ from, opacity }: { from: number; opacity: number }) {
  const frame = useCurrentFrame();
  const lines = terminal.sessions.flatMap((s) => [{ text: `$ ${s.command}`, cmd: true }, ...s.lines.map((text) => ({ text, cmd: false }))]);
  const shown = Math.floor(interpolate(frame, [from + 6, from + 6 + lines.length * 3], [0, lines.length], clamp));
  return (
    <div style={{ position: "absolute", left: 160, top: 150, width: 1040, opacity, transform: `translateY(${(1 - opacity) * 30}px)` }}>
      <div style={{ borderRadius: 22, overflow: "hidden", boxShadow: "0 40px 90px rgba(15,29,69,0.35)" }}>
        <div style={{ height: 44, background: "#1B2340", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
          {["#FF6159", "#FFBD2E", "#28C941"].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
          ))}
          <span style={{ marginLeft: 14, color: "rgba(255,255,255,0.55)", fontSize: 16, fontFamily: mono }}>splitsense · Mainnet</span>
        </div>
        <div style={{ background: "#0B1230", padding: "22px 26px", minHeight: 560, fontFamily: mono, fontSize: 17, lineHeight: 1.55, color: "#C9D4F2" }}>
          {lines.slice(0, shown).map((l, i) => (
            <div key={i} style={{ color: l.cmd ? C.teal : /✓|passed|verified|available|SUCCESS/.test(l.text) ? "#E6FBFA" : undefined, marginTop: l.cmd && i ? 14 : 0, whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis" }}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
