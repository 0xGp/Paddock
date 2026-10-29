import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, getInputProps, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { captures, clip, FPS, type Rect, type SceneId, type Shot } from "./data";
import { C, DARK_BG, EASE, LIGHT_BG, mono, sans } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over `duration` frames from `start`, eased. */
export const ease = (frame: number, start: number, duration = 18) => interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: EASE });

export const pop = (frame: number, start: number, fps = FPS) => spring({ frame: frame - start, fps, config: { damping: 18 } });

export function Background({ dark = false, children }: { dark?: boolean; children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: dark ? DARK_BG : LIGHT_BG, fontFamily: sans, color: dark ? "white" : C.ink }}>
      {!dark && (
        <AbsoluteFill
          style={{ background: "radial-gradient(60% 50% at 85% 0%, rgba(79,212,207,0.35), transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(31,79,184,0.12), transparent 70%)" }}
        />
      )}
      {children}
    </AbsoluteFill>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f1d45" />
          <stop offset="1" stopColor="#1f4fb8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-tile)" />
      <g transform="rotate(-12 18 18)">
        <rect x="7" y="11" width="23" height="14" rx="3" fill="#fff" />
        <circle cx="18.5" cy="18" r="3.4" fill="none" stroke="#1f4fb8" strokeWidth="1.8" />
        <circle cx="11" cy="18" r="1.1" fill="#1f4fb8" />
        <circle cx="26" cy="18" r="1.1" fill="#1f4fb8" />
      </g>
      <circle cx="28" cy="28" r="7" fill="#4fd4cf" stroke="#13265a" strokeWidth="2.2" />
      <circle cx="28" cy="28" r="3.8" fill="none" stroke="#1d7d86" strokeWidth="1.4" />
    </svg>
  );
}

export function Chip({ children, tone = "light", style }: { children: ReactNode; tone?: "light" | "dark" | "teal"; style?: CSSProperties }) {
  const tones = {
    light: { background: C.glass, color: C.ink, border: `1px solid ${C.line}` },
    dark: { background: "rgba(255,255,255,0.10)", color: "white", border: "1px solid rgba(255,255,255,0.18)" },
    teal: { background: "rgba(79,212,207,0.18)", color: C.tealDeep, border: "1px solid rgba(29,125,134,0.25)" },
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 600,
        whiteSpace: "nowrap",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(15,29,69,0.08)",
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SourceLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div style={{ position: "absolute", right: 64, top: 52, maxWidth: 760, textAlign: "right", fontSize: 18, fontWeight: 500, lineHeight: 1.5, color: dark ? "rgba(255,255,255,0.6)" : C.muted }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: C.teal, marginRight: 10, verticalAlign: "middle" }} />
      {children}
    </div>
  );
}

export const Mono = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <span style={{ fontFamily: mono, ...style }}>{children}</span>;

/** Narration as captions: short phrases, the spoken words in full ink. */
export function Captions({ id, dark = false }: { id: SceneId; dark?: boolean }) {
  const frame = useCurrentFrame();
  if (getInputProps().captions === false) return null;
  const t = frame / FPS;
  const words = clip(id).words;
  const phrases: (typeof words)[] = [[]];
  for (const w of words) {
    const cur = phrases.at(-1)!;
    cur.push(w);
    if (/[.,:;?!]$/.test(w.text) ? cur.length >= 2 || /[.?!]$/.test(w.text) : cur.length >= 7) phrases.push([]);
  }
  const list = phrases.filter((p) => p.length);
  const i = list.findIndex((p, k) => t >= p[0].start - 0.1 && (k === list.length - 1 ? t <= p.at(-1)!.end + 0.6 : t < list[k + 1][0].start - 0.1));
  if (i < 0) return null;
  const phrase = list[i];
  const fade = interpolate(t, [phrase[0].start - 0.1, phrase[0].start + 0.05], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          padding: "12px 28px",
          borderRadius: 999,
          background: dark ? "rgba(10,20,51,0.55)" : "rgba(255,255,255,0.78)",
          border: dark ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${C.line}`,
          backdropFilter: "blur(18px)",
          boxShadow: "0 10px 30px rgba(15,29,69,0.12)",
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: -0.2,
          opacity: fade,
          color: dark ? "white" : C.ink,
        }}
      >
        {phrase.map((w, k) => (
          <span key={k} style={{ opacity: t >= w.start - 0.02 ? 1 : 0.42 }}>
            {k ? " " : ""}
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- lines ---------- */

export type Pt = { x: number; y: number };

/** The first `t` (0–1, by length) of a polyline, and where its head is. */
export function partial(points: Pt[], t: number): { d: string; head: Pt; done: number } {
  if (points.length === 0) return { d: "", head: { x: 0, y: 0 }, done: 0 };
  const seg = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  let left = Math.max(0, Math.min(1, t)) * total;
  const out = [points[0]];
  let done = 0;
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i] - 1e-6) {
      out.push(points[i + 1]);
      left -= seg[i];
      done = i + 1;
    } else {
      const k = seg[i] ? left / seg[i] : 0;
      out.push({ x: points[i].x + (points[i + 1].x - points[i].x) * k, y: points[i].y + (points[i + 1].y - points[i].y) * k });
      break;
    }
  }
  return { d: out.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "), head: out.at(-1)!, done };
}

export function GlowLine({ d, color = C.teal, width = 5, glow = true }: { d: string; color?: string; width?: number; glow?: boolean }) {
  return (
    <>
      {glow && <path d={d} fill="none" stroke={color} strokeWidth={width * 3.2} strokeOpacity={0.18} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function Dot({ x, y, scale = 1, color = C.teal, ring = "white", r = 9 }: Pt & { scale?: number; color?: string; ring?: string; r?: number }) {
  return <circle cx={x} cy={y} r={r * scale} fill={color} stroke={ring} strokeWidth={3.5 * scale} />;
}

/* ---------- captures of the live app ---------- */

export type Region = { x: number; y: number; w: number };
export type Box = { x: number; y: number; width: number; height: number };
export const FRAME_BOX: Box = { x: 160, y: 112, width: 1600, height: 852 };

const shotOf = (shot: Shot) => captures.shots[shot] as { file: string; width: number; height: number; rects: Record<string, Rect> };
export const rectOf = (shot: Shot, key: string): Rect => {
  const r = shotOf(shot).rects[key];
  if (!r) throw new Error(`no rect ${key} in ${shot}`);
  return r;
};

/** The smallest camera region (at the box's aspect) that holds `rect` with padding, kept on the page. */
export function focus(shot: Shot, rect: Rect, { pad = 48, minW = 760, box = FRAME_BOX }: { pad?: number; minW?: number; box?: Box } = {}): Region {
  const { width: pw, height: ph } = shotOf(shot);
  const aspect = box.height / box.width;
  const w = Math.min(pw, Math.max(minW, rect.width + pad * 2, (rect.height + pad * 2) / aspect));
  const h = w * aspect;
  const x = Math.min(Math.max(0, rect.x + rect.width / 2 - w / 2), pw - w);
  const y = Math.min(Math.max(0, rect.y + rect.height / 2 - h / 2), Math.max(0, ph - h));
  return { x, y, w };
}

export const TOP: Region = { x: 0, y: 0, w: 1440 };

/** Where the camera is at `frame`: each key eases in from the previous one over `dur` frames. */
export function camera(frame: number, keys: { at: number; region: Region; dur?: number }[]): Region {
  let r = keys[0].region;
  for (const k of keys.slice(1)) {
    if (frame < k.at) break;
    const p = ease(frame, k.at, k.dur ?? 22);
    r = { x: r.x + (k.region.x - r.x) * p, y: r.y + (k.region.y - r.y) * p, w: r.w + (k.region.w - r.w) * p };
  }
  return r;
}

export type Ring = { rect: Rect; from: number; until?: number; radius?: number };
export type CursorKey = { at: number; x: number; y: number; click?: boolean };

export function Capture({
  layers,
  region,
  box = FRAME_BOX,
  rings = [],
  cursor,
  url,
  opacity = 1,
  style,
}: {
  layers: { shot: Shot; opacity: number }[];
  region: Region;
  box?: Box;
  rings?: Ring[];
  cursor?: CursorKey[];
  url: string;
  opacity?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = box.width / region.w;
  const map = (x: number, y: number) => ({ x: (x - region.x) * scale, y: (y - region.y) * scale });
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y - 48, width: box.width, opacity, ...style }}>
      <div
        style={{
          height: 48,
          borderRadius: "22px 22px 0 0",
          background: "rgba(255,255,255,0.88)",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 9,
        }}
      >
        {["#FF6159", "#FFBD2E", "#28C941"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            flex: 1,
            maxWidth: 760,
            height: 30,
            borderRadius: 15,
            background: "rgba(27,35,64,0.06)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: 17,
            color: C.muted,
            fontWeight: 500,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: C.tealDeep, marginRight: 8 }}>●</span>
          {url}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: box.height,
          overflow: "hidden",
          borderRadius: "0 0 22px 22px",
          background: "#EEF6FB",
          boxShadow: "0 40px 90px rgba(15,29,69,0.22), 0 0 0 1px rgba(15,29,69,0.06)",
        }}
      >
        {layers.map(({ shot, opacity: o }) => {
          const s = shotOf(shot);
          return o > 0 ? (
            <Img
              key={shot}
              src={staticFile(s.file)}
              style={{ position: "absolute", left: -region.x * scale, top: -region.y * scale, width: s.width * scale, height: s.height * scale, opacity: o, maxWidth: "none" }}
            />
          ) : null;
        })}
        {rings.map((r, i) => {
          if (frame < r.from || (r.until !== undefined && frame > r.until + 10)) return null;
          const p = map(r.rect.x, r.rect.y);
          const inn = spring({ frame: frame - r.from, fps, config: { damping: 14 } });
          const out = r.until === undefined ? 1 : interpolate(frame, [r.until, r.until + 10], [1, 0], clamp);
          const pad = 8;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x - pad,
                top: p.y - pad,
                width: r.rect.width * scale + pad * 2,
                height: r.rect.height * scale + pad * 2,
                borderRadius: (r.radius ?? 28) * scale + pad,
                border: `4px solid ${C.teal}`,
                boxShadow: `0 0 0 ${interpolate(inn, [0, 1], [0, 10])}px rgba(79,212,207,0.22), 0 0 40px rgba(79,212,207,0.35)`,
                opacity: inn * out,
                transform: `scale(${interpolate(inn, [0, 1], [1.06, 1])})`,
              }}
            />
          );
        })}
        {cursor && <Cursor keys={cursor} map={map} />}
      </div>
    </div>
  );
}

function Cursor({ keys, map }: { keys: CursorKey[]; map: (x: number, y: number) => Pt }) {
  const frame = useCurrentFrame();
  if (frame < keys[0].at - 6) return null;
  let pos = { x: keys[0].x, y: keys[0].y };
  let click = -1;
  for (const k of keys.slice(1)) {
    if (frame < k.at - 16) break;
    const p = ease(frame, k.at - 16, 16);
    pos = { x: pos.x + (k.x - pos.x) * p, y: pos.y + (k.y - pos.y) * p };
    if (k.click && frame >= k.at) click = k.at;
  }
  const at = map(pos.x, pos.y);
  const since = click < 0 ? 99 : frame - click;
  const press = since < 6 ? 0.85 : 1;
  return (
    <>
      {since < 18 && (
        <div
          style={{
            position: "absolute",
            left: at.x - 30,
            top: at.y - 30,
            width: 60,
            height: 60,
            borderRadius: 30,
            border: `3px solid ${C.teal}`,
            opacity: interpolate(since, [0, 18], [0.9, 0]),
            transform: `scale(${interpolate(since, [0, 18], [0.4, 1.4])})`,
          }}
        />
      )}
      <svg width={34} height={34} viewBox="0 0 24 24" style={{ position: "absolute", left: at.x - 4, top: at.y - 2, transform: `scale(${press})`, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))" }}>
        <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.4 L14.4 20.1 L11.4 13.6 L17.6 13.4 Z" fill="white" stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** A card that springs in at `from`. */
export function PopIn({ from, children, style, y = 24 }: { from: number; children: ReactNode; style?: CSSProperties; y?: number }) {
  const frame = useCurrentFrame();
  const p = pop(frame, from);
  if (frame < from) return null;
  return <div style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * y}px) scale(${0.96 + 0.04 * p})`, ...style }}>{children}</div>;
}

export function Card({ children, style, dark = false }: { children: ReactNode; style?: CSSProperties; dark?: boolean }) {
  return (
    <div
      style={{
        borderRadius: 28,
        padding: 28,
        background: dark ? "rgba(255,255,255,0.07)" : C.glass,
        border: dark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.9)",
        boxShadow: dark ? "none" : "0 24px 60px rgba(15,29,69,0.10)",
        backdropFilter: "blur(16px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Title({ kicker, children, dark = false, style }: { kicker?: string; children: ReactNode; dark?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: 160, top: 40, ...style }}>
      {kicker && (
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: dark ? C.teal : C.tealDeep, marginBottom: 6 }}>{kicker}</div>
      )}
      <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1, color: dark ? "white" : C.ink }}>{children}</div>
    </div>
  );
}
