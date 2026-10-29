import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { at, mainnet, NAME, roundLabel } from "../data";
import { C, MEMBER_COLOR, mono } from "../theme";
import { Background, Captions, Card, Chip, clamp, Dot, ease, GlowLine, partial, pop, PopIn, SourceLabel, Title, type Pt } from "../ui";

const LEFT = 330;
const RIGHT = 1590;
const TOP = 300;
const BOTTOM = 770;
const rounds = mainnet.learning.map((l) => l.asOf);
const xOf = (i: number) => LEFT + (i * (RIGHT - LEFT)) / (rounds.length - 1);
const yOf = (v: number, max: number) => BOTTOM - (v / max) * (BOTTOM - TOP);

/** Draws a line through `values`, reaching point i at frame `hits[i]`. */
function useDraw(values: number[], max: number, hits: number[]) {
  const frame = useCurrentFrame();
  const pts: Pt[] = values.map((v, i) => ({ x: xOf(i), y: yOf(v, max) }));
  const t = interpolate(frame, hits, hits.map((_, i) => i / (hits.length - 1)), clamp);
  return { pts, ...partial(pts, t), t, frame };
}

const spread = (from: number, to: number, n = rounds.length) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * i) / (n - 1)));

function Axis({ ticks, unit, opacity }: { ticks: number[]; unit: (v: number) => string; opacity: number }) {
  const max = ticks.at(-1)!;
  return (
    <g opacity={opacity}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={LEFT - 40} x2={RIGHT + 40} y1={yOf(v, max)} y2={yOf(v, max)} stroke={C.line} strokeDasharray={v ? "4 8" : undefined} strokeWidth={2} />
          <text x={LEFT - 60} y={yOf(v, max) + 7} fontSize={20} fill={C.muted} textAnchor="end" fontFamily={mono}>
            {unit(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Layer({ show, children }: { show: number; children: ReactNode }) {
  return show > 0.01 ? <g opacity={show}>{children}</g> : null;
}

export function Learning() {
  const frame = useCurrentFrame();
  const bStart = at("learning", "Tolu's diesel run");
  const cStart = at("learning", "Emeka got quicker");
  const dStart = at("learning", "And when the groceries");
  const stopped = at("learning", "stopped holding");
  const forget = at("learning", "Forgetting is a memory");

  const showA = 1 - ease(frame, bStart - 4, 12);
  const showB = ease(frame, bStart - 2, 12) * (1 - ease(frame, cStart - 4, 12));
  const showC = ease(frame, cStart - 2, 12);

  const A = useDraw(
    mainnet.learning.map((l) => l.cumulative),
    40,
    spread(at("learning", "Six things"), at("learning", "Thirty-five")),
  );
  const B = useDraw(
    mainnet.dieselTurn.map((d) => d.share * 100),
    100,
    spread(bStart + 10, at("learning", "Godspower")),
  );
  const cHits = spread(cStart + 4, cStart + 40);
  const speed = Object.entries(mainnet.settleSpeed).map(([id, pts]) => ({ id, ...partial(pts.map((p, i) => ({ x: xOf(i), y: yOf(p.score, 100) })), interpolate(frame, cHits, cHits.map((_, i) => i / 4), clamp)), pts }));

  const title = frame < bStart ? "Things Paddock noticed or revised" : frame < cStart ? "Tolu's share of the diesel bills" : "Settle speed, score out of 100";
  const axisIn = ease(frame, 4, 16);

  return (
    <Background>
      <Title kicker="How it learned over time · every dot is a memory on Walrus Mainnet">{title}</Title>

      <Card style={{ position: "absolute", left: 160, top: 170, width: 1600, height: 760, padding: 0 }}>{null}</Card>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {rounds.map((r, i) => (
          <g key={r} opacity={axisIn}>
            <line x1={xOf(i)} x2={xOf(i)} y1={TOP - 40} y2={BOTTOM} stroke={C.line} strokeWidth={2} />
            <text x={xOf(i)} y={BOTTOM + 48} fontSize={24} fontWeight={700} fill={C.ink} textAnchor="middle">
              {roundLabel(r)}
            </text>
          </g>
        ))}
        <text x={(LEFT + RIGHT) / 2} y={BOTTOM + 84} fontSize={18} fill={C.muted} textAnchor="middle" fontFamily={mono} opacity={axisIn}>
          LEARNING ROUND (AS OF)
        </text>

        <Layer show={showA}>
          <Axis ticks={[0, 10, 20, 30, 40]} unit={(v) => `${v}`} opacity={1} />
          <path d={`${A.d} L${A.head.x},${BOTTOM} L${LEFT},${BOTTOM} Z`} fill="rgba(79,212,207,0.14)" />
          <GlowLine d={A.d} width={6} color={C.tealDeep} />
          {A.pts.map((p, i) => i <= A.done && <Dot key={i} {...p} scale={pop(frame, spread(at("learning", "Six things"), at("learning", "Thirty-five"))[i])} color={C.teal} />)}
        </Layer>

        <Layer show={showB}>
          <Axis ticks={[0, 25, 50, 75, 100]} unit={(v) => `${v}%`} opacity={1} />
          <GlowLine d={B.d} width={6} color={C.blue} />
          {B.pts.map((p, i) => i <= B.done && <Dot key={i} {...p} color={i >= 3 ? C.blue : C.teal} />)}
        </Layer>

        <Layer show={showC}>
          <Axis ticks={[0, 25, 50, 75, 100]} unit={(v) => `${v}`} opacity={1} />
          {speed.map((s) => (
            <g key={s.id} opacity={s.id === "emeka" || frame < cStart + 80 ? 1 : 0.35}>
              <GlowLine d={s.d} width={s.id === "emeka" ? 6 : 4} color={MEMBER_COLOR[s.id]} glow={s.id === "emeka"} />
              {s.done >= 0 && <Dot x={s.head.x} y={s.head.y} r={7} color={MEMBER_COLOR[s.id]} />}
            </g>
          ))}
        </Layer>
      </svg>

      {showA > 0.01 && (
        <div style={{ opacity: showA }}>
          {mainnet.learning.map((l, i) => {
            if (i > A.done) return null;
            const p = A.pts[i];
            const label = [l.new && `${l.new} new`, l.changed && `${l.changed} revised`, l.retired && `${l.retired} forgotten`].filter(Boolean).join(" · ");
            return (
              <div key={l.asOf} style={{ position: "absolute", left: p.x - 150, width: 300, top: p.y - 92, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{l.cumulative}</div>
                <div style={{ fontSize: 19, color: C.muted, fontWeight: 600 }}>{label}</div>
              </div>
            );
          })}
        </div>
      )}

      {showB > 0.01 && (
        <div style={{ opacity: showB }}>
          {mainnet.dieselTurn.map((d, i) => {
            if (i > B.done) return null;
            const p = B.pts[i];
            const next = NAME[d.nextPayer];
            return (
              <div key={d.asOf} style={{ position: "absolute", left: p.x - 150, width: 300, top: p.y - 100, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800 }}>
                  {d.usualCount}/{d.totalCount}
                </div>
                <div style={{ fontSize: 19, fontWeight: 600, color: d.nextPayer === "godspower" ? C.blue : C.muted }}>next: {next}</div>
                <div style={{ marginTop: 56, fontFamily: mono, fontSize: 15, color: C.muted }}>blob {d.blobId.slice(0, 8)}…</div>
              </div>
            );
          })}
        </div>
      )}

      {showC > 0.01 && (
        <div style={{ opacity: showC }}>
          {speed.map((s) =>
            s.done >= 4 ? (
              <div key={s.id} style={{ position: "absolute", left: RIGHT + 24, top: yOf(s.pts[4].score, 100) - 16, fontSize: 22, fontWeight: 700, color: MEMBER_COLOR[s.id] }}>
                {NAME[s.id]} {s.pts[4].score}
              </div>
            ) : null,
          )}
          <div style={{ position: "absolute", left: xOf(3) - 200, top: yOf(mainnet.settleSpeed.emeka[3].score, 100) + 30 }}>
            <PopIn from={cStart + 36}>
              <Chip style={{ background: C.owes, color: "white", border: "none" }}>
                Emeka: typical delay ~{mainnet.settleSpeed.emeka[2].medianDelayDays} days → ~{mainnet.settleSpeed.emeka[3].medianDelayDays} days
              </Chip>
            </PopIn>
          </div>
        </div>
      )}

      {frame >= dStart && <Groceries from={dStart} stopped={stopped} forget={forget} />}

      <SourceLabel>Source: Walrus Mainnet · namespace {mainnet.namespace}</SourceLabel>
      <Captions id="learning" />
    </Background>
  );
}

function Groceries({ from, stopped, forget }: { from: number; stopped: number; forget: number }) {
  const frame = useCurrentFrame();
  const [before, after] = mainnet.groceriesTurn;
  const gone = ease(frame, stopped, 14);
  return (
    <div style={{ position: "absolute", inset: 0, background: `rgba(230,240,252,${0.75 * ease(frame, from, 12)})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <PopIn from={from + 4}>
        <Card style={{ width: 1240, padding: 40 }}>
          <div style={{ fontFamily: mono, fontSize: 18, color: C.tealDeep, letterSpacing: 2 }}>GROCERIES ROTATION</div>
          <div style={{ display: "flex", gap: 28, marginTop: 22, alignItems: "stretch" }}>
            <div style={{ flex: 1.3, padding: 24, borderRadius: 22, background: "white", opacity: 1 - 0.45 * gone }}>
              <div style={{ fontSize: 20, color: C.muted, fontWeight: 600 }}>{roundLabel(before.asOf)}</div>
              <div style={{ position: "relative", fontSize: 30, fontWeight: 700, marginTop: 6 }}>
                {NAME[before.usualPayer]} {before.usualCount} of {before.totalCount} · next {NAME[before.nextPayer]}
                <div style={{ position: "absolute", left: 0, top: "52%", height: 4, width: `${gone * 100}%`, background: C.owes, borderRadius: 2 }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 16, color: C.muted, marginTop: 10 }}>blob {before.blobId.slice(0, 10)}…</div>
            </div>
            {frame >= stopped && (
              <PopIn from={stopped + 6} style={{ flex: 1 }}>
                <div style={{ height: "100%", boxSizing: "border-box", padding: 24, borderRadius: 22, background: C.ink, color: "white" }}>
                  <div style={{ fontSize: 20, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{roundLabel(after.asOf)}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>No longer holds</div>
                  <div style={{ fontFamily: mono, fontSize: 16, color: C.teal, marginTop: 10 }}>blob {after.blobId.slice(0, 10)}…</div>
                </div>
              </PopIn>
            )}
          </div>
          {frame >= forget && (
            <PopIn from={forget}>
              <div style={{ marginTop: 30, fontSize: 52, fontWeight: 800, letterSpacing: -1.5, textAlign: "center" }}>Forgetting is a memory.</div>
            </PopIn>
          )}
        </Card>
      </PopIn>
    </div>
  );
}
