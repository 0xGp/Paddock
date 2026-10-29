// Runs `pnpm video:data` and `pnpm test` from the repo root and keeps their real output for the terminal shot.
// Refreshing the data here also means the video renders from a fresh Mainnet read.
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(args) {
  const started = Date.now();
  const r = spawnSync("pnpm", args, { cwd: REPO, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  if (r.status !== 0) throw new Error(`pnpm ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return { lines: strip(r.stdout).split("\n"), seconds: (Date.now() - started) / 1000 };
}

console.log("Running pnpm video:data (Walrus Mainnet + Tatum)…");
const data = run(["video:data"]);
const dataLines = data.lines.filter((l) => l.trim() && !l.startsWith(">"));

console.log("Running pnpm test…");
const test = run(["-r", "--if-present", "test"]);
const testLines = test.lines.filter((l) => /Tests\s+\d+ passed/.test(l)).map((l) => l.replace(/\s+/g, " ").trim());
const passed = testLines.reduce((n, l) => n + Number(l.match(/Tests (\d+) passed/)[1]), 0);

const out = {
  ranAt: new Date().toISOString(),
  sessions: [
    { command: "pnpm video:data", lines: dataLines, seconds: +data.seconds.toFixed(1) },
    { command: "pnpm test", lines: [...testLines, `${passed} passed`], seconds: +test.seconds.toFixed(1) },
  ],
  unitTests: passed,
};
await writeFile(new URL("../src/terminal.json", import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote src/terminal.json · ${passed} unit tests passed`);
