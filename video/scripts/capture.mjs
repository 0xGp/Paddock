// Screenshots of the live app (and the explorers it links to) for the video.
// Writes PNGs to public/captures/ and the on-page position of every element a scene zooms into to captures.json.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const SITE = process.env.VIDEO_SITE ?? "https://usepaddock.online";
const OUT = fileURLToPath(new URL("../public/captures/", import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };
const DIESEL_BLOB = "_x__n1nD3gleY_ZQduTJtcNYmFIhPUg7R0H3A4yOiDY";
const SETTLE_TX = "9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV";

const DEMO_TARGETS = {
  balance: "section[aria-labelledby='open-total']",
  memory: "#memory-section",
  turns: "#turns-section",
  upcoming: "#upcoming-section",
  speed: "#speed-section",
  settle: "#settle-section",
  timeline: "#timeline-section",
  switch: "[role='switch']",
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, colorScheme: "light", locale: "en-GB" });
const page = await context.newPage();
const manifest = { site: SITE, capturedAt: new Date().toISOString(), viewport: VIEWPORT, scale: 2, shots: {} };

async function rects(targets) {
  return page.evaluate((t) => {
    const out = {};
    for (const [key, sel] of Object.entries(t)) {
      const el = typeof sel === "string" ? document.querySelector(sel) : null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[key] = { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
    }
    return out;
  }, targets);
}

async function shoot(name, { fullPage = true, targets = {}, extra = {} } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const file = `${name}.png`;
  await page.screenshot({ path: `${OUT}${file}`, fullPage, animations: "disabled" });
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  manifest.shots[name] = { file: `captures/${file}`, width: VIEWPORT.width, height: fullPage ? size.height : VIEWPORT.height, rects: await rects(targets), ...extra };
  console.log(`  ✓ ${name}`);
}

async function openDetails(scope, text) {
  const summary = page.locator(`${scope} details > summary`).filter({ hasText: text }).first();
  await summary.scrollIntoViewIfNeeded();
  await summary.click();
  await page.waitForTimeout(500);
  return summary;
}

async function markDetails(text, scope) {
  await page.evaluate(
    ([s, t]) => {
      for (const el of document.querySelectorAll(`${s} details`)) {
        if (el.querySelector("summary")?.textContent?.includes(t)) el.setAttribute("data-video", "focus");
      }
    },
    [scope, text],
  );
}

console.log(`Capturing ${SITE}`);

await page.goto(`${SITE}/demo`, { waitUntil: "networkidle" });
await shoot("demo-on", { targets: DEMO_TARGETS });

await page.click("[role='switch']");
await shoot("demo-off", { targets: DEMO_TARGETS });
await page.click("[role='switch']");

await openDetails("#turns-section", "Diesel");
await markDetails("Diesel", "#turns-section");
await shoot("demo-why", { targets: { ...DEMO_TARGETS, why: "#turns-section details[data-video='focus']" } });

await page.goto(`${SITE}/demo`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const d of document.querySelectorAll("#timeline-section details")) d.open = false;
});
await openDetails("#timeline-section", "15 Oct");
await markDetails("15 Oct", "#timeline-section");
await shoot("demo-timeline", { targets: { ...DEMO_TARGETS, day: "#timeline-section details[data-video='focus']" } });

await page.goto(`${SITE}/status`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const statusText = await page.evaluate(() => document.body.innerText);
const latencies = [...statusText.matchAll(/(\d{1,5})\s?ms\b/g)].map((m) => Number(m[1]));
await shoot("status", { extra: { latenciesMs: latencies } });

for (const [name, url] of [
  ["walruscan-blob", `https://walruscan.com/mainnet/blob/${DIESEL_BLOB}`],
  ["suiscan-tx", `https://suiscan.xyz/mainnet/tx/${SETTLE_TX}`],
]) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(4000);
    await shoot(name, { fullPage: false, extra: { url } });
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message.split("\n")[0]}`);
  }
}

await browser.close();
await writeFile(new URL("../src/captures.json", import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Wrote src/captures.json");
