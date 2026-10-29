import mainnet from "../data/mainnet.json";
import captures from "./captures.json";
import terminal from "./terminal.json";
import voice from "./voice.json";

export { captures, mainnet, terminal, voice };

export const FPS = 30;
/** Silence after each clip before the next scene starts. */
export const AIR = 12;

export type SceneId = "problem" | "paddock" | "memory" | "proof" | "learning" | "verified" | "settle" | "check" | "close";
export type Shot = keyof typeof captures.shots;
export type Rect = { x: number; y: number; width: number; height: number };

export const clip = (id: SceneId) => {
  const c = voice.scenes.find((s) => s.id === id);
  if (!c) throw new Error(`no voice clip for ${id}; run pnpm --filter @splitsense/video voice`);
  return c;
};

export const sceneFrames = (id: SceneId) => Math.ceil(clip(id).seconds * FPS) + AIR;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The frame (within the scene) where `phrase` starts being spoken. */
export function at(id: SceneId, phrase: string, nth = 0): number {
  const words = clip(id).words;
  const want = phrase.split(/\s+/).map(norm);
  let seen = 0;
  for (let i = 0; i + want.length <= words.length; i++) {
    if (want.every((w, j) => norm(words[i + j].text) === w)) {
      if (seen++ === nth) return Math.round(words[i].start * FPS);
    }
  }
  throw new Error(`"${phrase}" is not in the ${id} narration`);
}

/** The frame where `phrase` finishes. */
export function after(id: SceneId, phrase: string, nth = 0): number {
  const start = at(id, phrase, nth);
  const words = clip(id).words;
  const i = words.findIndex((w) => Math.round(w.start * FPS) === start);
  const last = words[i + phrase.split(/\s+/).length - 1];
  return Math.round(last.end * FPS);
}

export const shortId = (id: string, n = 8) => `${id.slice(0, n)}…`;
export const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const NAME: Record<string, string> = { godspower: "Godspower", tolu: "Tolu", ada: "Ada", emeka: "Emeka" };
export const roundLabel = (asOf: string) =>
  new Date(`${asOf}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
