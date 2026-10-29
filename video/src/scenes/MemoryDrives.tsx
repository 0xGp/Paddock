import { interpolate, useCurrentFrame } from "remotion";
import { at, mainnet } from "../data";
import { C } from "../theme";
import { Background, camera, Capture, Captions, Chip, clamp, focus, PopIn, rectOf, TOP } from "../ui";

const SITE = "usepaddock.online/demo";

export function MemoryDrives() {
  const frame = useCurrentFrame();
  const recall = at("memory", "Paddock just recalled");
  const turns = at("memory", "Whose turn");
  const coming = at("memory", "Coming up");
  const speed = at("memory", "Settle speed");
  const switchAt = at("memory", "Switch memory off");
  const click = switchAt + 8;
  const same = at("memory", "Same balances");
  const noIdea = at("memory", "No idea");

  const region = camera(frame, [
    { at: 0, region: TOP },
    { at: at("memory", "thirty-seven bills"), region: focus("demo-on", rectOf("demo-on", "memory"), { minW: 1000 }) },
    { at: turns - 4, region: focus("demo-on", rectOf("demo-on", "turns"), { minW: 980 }) },
    { at: coming - 4, region: focus("demo-on", rectOf("demo-on", "upcoming"), { minW: 980 }) },
    { at: speed - 4, region: focus("demo-on", rectOf("demo-on", "speed"), { minW: 980 }) },
    { at: switchAt - 22, region: TOP },
  ]);
  const off = interpolate(frame, [click, click + 10], [0, 1], clamp);
  const sw = rectOf("demo-on", "switch");

  return (
    <Background>
      <Capture
        url={SITE}
        region={region}
        layers={[
          { shot: "demo-on", opacity: 1 },
          { shot: "demo-off", opacity: off },
        ]}
        rings={[
          { rect: rectOf("demo-on", "memory"), from: recall, until: turns - 6 },
          { rect: rectOf("demo-on", "turns"), from: turns, until: coming - 6 },
          { rect: rectOf("demo-on", "upcoming"), from: coming, until: speed - 6 },
          { rect: rectOf("demo-on", "speed"), from: speed, until: switchAt - 20 },
          { rect: sw, from: switchAt - 4, until: click + 14, radius: 20 },
          { rect: rectOf("demo-off", "balance"), from: same, until: noIdea - 4 },
          { rect: rectOf("demo-off", "turns"), from: noIdea },
        ]}
        cursor={[
          { at: switchAt - 30, x: 1000, y: 380 },
          { at: click, x: sw.x + sw.width - 30, y: sw.y + sw.height / 2, click: true },
          { at: same, x: 700, y: 260 },
        ]}
      />
      <div style={{ position: "absolute", left: 120, top: 14 }}>
        <PopIn from={6}>
          <Chip tone="teal">Judge mode · no sign-in</Chip>
        </PopIn>
      </div>
      <div style={{ position: "absolute", right: 120, top: 14, display: "flex", gap: 12 }}>
        <PopIn from={recall + 6}>
          <Chip>
            <span style={{ color: C.tealDeep }}>●</span> {mainnet.recall.recalled} recalled · {mainnet.recall.verified} verified · {mainnet.recall.rejected} rejected
          </Chip>
        </PopIn>
        {frame >= click && (
          <PopIn from={click + 4}>
            <Chip style={{ background: C.ink, color: "white" }}>Memory off</Chip>
          </PopIn>
        )}
      </div>
      <Captions id="memory" />
    </Background>
  );
}
