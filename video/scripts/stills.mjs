// Renders single frames: `node scripts/stills.mjs 300 1200` → out/stills/<frame>.jpg (half size, for review),
// or `node scripts/stills.mjs --out ../docs/blog --clean spend=367 learning=2627` → full-size PNGs without captions.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? resolve(args[outIdx + 1]) : `${ROOT}out/stills`;
const clean = args.includes("--clean");
const shots = args
  .filter((a, i) => !a.startsWith("--") && i !== outIdx + 1)
  .map((a) => (a.includes("=") ? a.split("=") : [a, a]))
  .map(([name, frame]) => ({ name, frame: Number(frame) }));

const inputProps = clean ? { captions: false } : {};
const serveUrl = await bundle({ entryPoint: `${ROOT}src/index.ts` });
const composition = await selectComposition({ serveUrl, id: "Paddock", inputProps });
await mkdir(outDir, { recursive: true });
for (const { name, frame } of shots) {
  const ext = clean ? "png" : "jpg";
  const format = clean ? { imageFormat: "png" } : { imageFormat: "jpeg", jpegQuality: 70 };
  await renderStill({ serveUrl, composition, frame, inputProps, output: `${outDir}/${name}.${ext}`, ...format, scale: clean ? 1 : 0.5 });
  console.log(`  ✓ ${name}`);
}
