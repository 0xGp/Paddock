import { interpolate, useCurrentFrame } from "remotion";
import { at, mainnet, usd } from "../data";
import { C, mono } from "../theme";
import { Background, Captions, clamp, Dot, GlowLine, pop, PopIn, SourceLabel, Title } from "../ui";

const X0 = 230;
const X1 = 1700;
const Y0 = 860;
const Y1 = 300;
const TOP = 900;
const DAY = 86_400_000;
const start = Date.parse(`${mainnet.spend[0].date}T00:00:00Z`);
const end = Date.parse(`${mainnet.spend.at(-1)!.date}T00:00:00Z`);
const xOf = (date: string) => X0 + ((Date.parse(`${date}T00:00:00Z`) - start) / (end - start)) * (X1 - X0);
const yOf = (v: number) => Y0 - (v / TOP) * (Y0 - Y1);

const BUBBLES = [
  { who: "Ada", text: "who bought diesel last??", right: false },
  { who: "Emeka", text: "not me", right: false },
  { who: "Tolu", text: "I did. Last week. And the week before.", right: true },
  { who: "Ada", text: "…", right: false },
];

function totals(description: string) {
  const bills = mainnet.spend.filter((s) => s.description === description);
  return { count: bills.length, sum: bills.reduce((n, s) => n + s.usdc, 0) };
}

export function Problem() {
  const frame = useCurrentFrame();
  const drawFrom = 12;
  const drawTo = at("problem", "Someone");
  const hx = interpolate(frame, [drawFrom, drawTo], [X0, X1], clamp);

  const pts = [{ x: X0, y: Y0 }];
  let cum = 0;
  let last = -1;
  mainnet.spend.forEach((s, i) => {
    const x = xOf(s.date);
    if (x > hx) return;
    pts.push({ x, y: yOf(cum) }, { x, y: yOf(s.cumulativeUsdc) });
    cum = s.cumulativeUsdc;
    last = i;
  });
  pts.push({ x: hx, y: yOf(cum) });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${d} L${hx.toFixed(1)},${Y0} L${X0},${Y0} Z`;
  const head = pts.at(-1)!;
  const bill = last >= 0 ? mainnet.spend[last] : null;
  const billFrame = bill ? drawFrom + ((xOf(bill.date) - X0) / (X1 - X0)) * (drawTo - drawFrom) : 0;

  const argue = at("problem", "and the argument");
  const dim = interpolate(frame, [argue, argue + 12], [1, 0.35], clamp);
  const callouts = [
    { word: "Diesel", name: "Generator diesel", note: "every week" },
    { word: "Prepaid", name: "IKEDC prepaid token", note: "prepaid power" },
    { word: "Data.", name: "Spectranet data", note: "monthly" },
  ];
  const months = ["2026-08-01", "2026-09-01", "2026-10-01", mainnet.spend.at(-1)!.date];

  return (
    <Background dark>
      <Title kicker="Flat 3B · Lagos · 1 Aug – 28 Oct" dark>
        The money never stops.
      </Title>
      <div style={{ opacity: dim }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={C.teal} stopOpacity={0.28} />
              <stop offset="1" stopColor={C.teal} stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0, 200, 400, 600, 800].map((v) => (
            <g key={v} opacity={interpolate(frame, [0, 15], [0, 1], clamp)}>
              <line x1={X0} x2={X1 + 40} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,0.10)" strokeDasharray={v ? "4 8" : undefined} />
              <text x={X0 - 22} y={yOf(v) + 7} fill="rgba(255,255,255,0.5)" fontSize={20} textAnchor="end" fontFamily={mono}>
                {v}
              </text>
            </g>
          ))}
          <text x={X0 - 22} y={Y1 - 30} fill="rgba(255,255,255,0.5)" fontSize={18} textAnchor="end" fontFamily={mono}>
            USDC
          </text>
          {months.map((m, i) => (
            <text key={m} x={xOf(m)} y={Y0 + 44} fill="rgba(255,255,255,0.55)" fontSize={20} textAnchor={i === 3 ? "end" : "start"} fontFamily={mono}>
              {new Date(`${m}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
            </text>
          ))}
          <path d={area} fill="url(#spend-fill)" />
          <GlowLine d={d} width={5} />
          <Dot x={head.x} y={head.y} r={10} ring={C.navy} />
        </svg>

        {bill && frame < drawTo + 40 && (
          <div
            style={{
              position: "absolute",
              left: Math.min(head.x - 20, X1 - 380),
              top: head.y - 104,
              opacity: pop(frame, billFrame),
              transform: `translateY(${(1 - pop(frame, billFrame)) * 10}px)`,
              padding: "10px 16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 22,
              whiteSpace: "nowrap",
            }}
          >
            {bill.description} <b style={{ color: C.teal }}>{usd(bill.usdc)} USDC</b>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: head.x - 24,
            top: head.y + 30,
            padding: "8px 18px",
            borderRadius: 18,
            background: "rgba(10,20,51,0.82)",
            border: "1px solid rgba(79,212,207,0.3)",
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: -1,
            whiteSpace: "nowrap",
            transform: "translateX(-100%)",
          }}
        >
          {usd(cum)} <span style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>USDC · {last + 1} bills</span>
        </div>

        <div style={{ position: "absolute", left: X0 + 20, top: 210, display: "flex", gap: 16 }}>
          {callouts.map((c) => {
            const t = totals(c.name);
            return (
              <PopIn key={c.name} from={at("problem", c.word)}>
                <div style={{ padding: "14px 20px", borderRadius: 20, background: "rgba(79,212,207,0.14)", border: "1px solid rgba(79,212,207,0.4)" }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 19, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                    {c.note} · {t.count} bills · {usd(t.sum)} USDC
                  </div>
                </div>
              </PopIn>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", right: 200, top: 300, width: 640, display: "flex", flexDirection: "column", gap: 18 }}>
        {BUBBLES.map((b, i) => (
          <PopIn key={i} from={argue + 4 + i * 9} style={{ alignSelf: b.right ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", margin: b.right ? "0 12px 6px auto" : "0 0 6px 12px", width: "fit-content" }}>{b.who}</div>
            <div
              style={{
                padding: "16px 24px",
                borderRadius: b.right ? "26px 26px 6px 26px" : "26px 26px 26px 6px",
                background: b.right ? C.teal : "white",
                color: C.navy,
                fontSize: 30,
                fontWeight: 600,
                boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
              }}
            >
              {b.text}
            </div>
          </PopIn>
        ))}
      </div>

      <SourceLabel dark>Bills from 4 ledger checkpoints on Walrus Mainnet · USDC at the flat's rate from its Walrus group profile</SourceLabel>
      <Captions id="problem" dark />
    </Background>
  );
}
