import { interpolate, useCurrentFrame } from "remotion";
import { at, captures, mainnet } from "../data";
import { C, mono } from "../theme";
import { Background, camera, Capture, Captions, Card, Chip, clamp, focus, PopIn, rectOf } from "../ui";

const BLOB_ID_ON_WALRUSCAN = { x: 52, y: 198, width: 730, height: 46 };

export function Proof() {
  const frame = useCurrentFrame();
  const diesel = at("proof", "Diesel: Godspower");
  const tap = at("proof", "Tap it");
  const open = tap + 8;
  const formula = at("proof", "the formula");
  const blob = at("proof", "the exact Walrus blob");
  const toWalruscan = blob + 4;
  const noAi = at("proof", "No AI model");

  const turns = rectOf("demo-on", "turns");
  const why = rectOf("demo-why", "why");
  const region = camera(frame, [
    { at: 0, region: focus("demo-on", turns, { minW: 1060 }) },
    { at: open + 2, region: focus("demo-why", why, { minW: 1060, pad: 40 }) },
  ]);
  const whyIn = interpolate(frame, [open, open + 10], [0, 1], clamp);
  const swap = interpolate(frame, [toWalruscan, toWalruscan + 14], [0, 1], clamp);
  const last = mainnet.dieselTurn.at(-1)!;

  return (
    <Background>
      <Capture
        url="usepaddock.online/demo"
        region={region}
        opacity={1 - swap}
        layers={[
          { shot: "demo-on", opacity: 1 },
          { shot: "demo-why", opacity: whyIn },
        ]}
        rings={[
          { rect: { x: turns.x + 8, y: turns.y + 64, width: turns.width - 16, height: 74 }, from: diesel, until: open, radius: 16 },
          { rect: why, from: formula, radius: 16 },
        ]}
        cursor={[
          { at: diesel, x: 1180, y: 300 },
          { at: open, x: turns.x + 200, y: turns.y + 100, click: true },
        ]}
      />
      {swap > 0 && (
        <Capture
          url={captures.shots["walruscan-blob"].url.replace("https://", "")}
          region={camera(frame, [
            { at: 0, region: { x: 0, y: 40, w: 1440 } },
            { at: toWalruscan + 8, region: { x: 0, y: 70, w: 1150 }, dur: 30 },
          ])}
          opacity={swap}
          style={{ transform: `translateY(${(1 - swap) * 30}px)` }}
          layers={[{ shot: "walruscan-blob", opacity: 1 }]}
          rings={[{ rect: BLOB_ID_ON_WALRUSCAN, from: toWalruscan + 18, radius: 10 }]}
        />
      )}
      <div style={{ position: "absolute", right: 120, top: 14 }}>
        <PopIn from={formula}>
          <Chip>
            Remembered on Walrus · blob <span style={{ fontFamily: mono, color: C.tealDeep }}>{last.blobId.slice(0, 12)}…</span>
          </Chip>
        </PopIn>
      </div>
      <div style={{ position: "absolute", left: 200, bottom: 150 }}>
        <PopIn from={noAi}>
          <Card style={{ padding: "22px 28px", background: C.navy, color: "white", border: "none" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>No AI model guessing</div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>Fixed, versioned rules · same inputs, same answer · ADR 0002</div>
          </Card>
        </PopIn>
      </div>
      <Captions id="proof" />
    </Background>
  );
}
