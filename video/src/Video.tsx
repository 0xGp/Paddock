import type { FC } from "react";
import { AbsoluteFill, Audio, interpolate, Series, staticFile, useCurrentFrame } from "remotion";
import { clip, sceneFrames, type SceneId } from "./data";
import { Check } from "./scenes/Check";
import { Close } from "./scenes/Close";
import { Intro } from "./scenes/Intro";
import { Learning } from "./scenes/Learning";
import { MemoryDrives } from "./scenes/MemoryDrives";
import { Problem } from "./scenes/Problem";
import { Proof } from "./scenes/Proof";
import { Settle } from "./scenes/Settle";
import { Verified } from "./scenes/Verified";

export const SCENES: { id: SceneId; Scene: FC }[] = [
  { id: "problem", Scene: Problem },
  { id: "paddock", Scene: Intro },
  { id: "memory", Scene: MemoryDrives },
  { id: "proof", Scene: Proof },
  { id: "learning", Scene: Learning },
  { id: "verified", Scene: Verified },
  { id: "settle", Scene: Settle },
  { id: "check", Scene: Check },
  { id: "close", Scene: Close },
];

export const totalFrames = () => SCENES.reduce((n, s) => n + sceneFrames(s.id), 0);

function FadeIn({ children, frames }: { children: React.ReactNode; frames: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, frames - 6, frames], [0, 1, 1, 0.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Paddock() {
  return (
    <AbsoluteFill style={{ background: "#0A1433" }}>
      <Series>
        {SCENES.map(({ id, Scene }) => (
          <Series.Sequence key={id} durationInFrames={sceneFrames(id)} name={id}>
            <FadeIn frames={sceneFrames(id)}>
              <Scene />
            </FadeIn>
            <Audio src={staticFile(clip(id).file)} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
