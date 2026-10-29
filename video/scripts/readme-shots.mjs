// Re-shoots the README's /demo and /status screenshots from the live site into docs/screens/.
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const SITE = process.env.VIDEO_SITE ?? "https://usepaddock.online";
const SCREENS = fileURLToPath(new URL("../../docs/screens/", import.meta.url));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, colorScheme: "light", locale: "en-GB" })).newPage();
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
};
const shot = async (file, opts = {}) => {
  await settle();
  await page.screenshot({ path: `${SCREENS}${file}`, animations: "disabled", ...opts });
  console.log(`  ✓ ${file}`);
};

await page.goto(`${SITE}/demo`, { waitUntil: "networkidle" });
await shot("proof/demo-memory-on.png");
await page.click("[role='switch']");
await shot("proof/demo-memory-off.png");
await page.click("[role='switch']");

const diesel = page.locator("#turns-section details > summary").filter({ hasText: "Diesel" }).first();
await diesel.click();
await page.evaluate(() => {
  const el = document.querySelector("#turns-section");
  scrollTo(0, el.getBoundingClientRect().top + scrollY - 24);
});
await shot("proof/demo-why-memory.png");

await page.goto(`${SITE}/demo`, { waitUntil: "networkidle" });
await shot("demo-desktop.png", { fullPage: true });
await page.evaluate(() => {
  for (const d of document.querySelectorAll("#timeline-section details")) d.open = false;
});
await page.locator("#timeline-section details > summary").filter({ hasText: "15 Oct" }).first().click();
await settle();
await page.locator("#timeline-section").screenshot({ path: `${SCREENS}proof/demo-timeline.png`, animations: "disabled" });
console.log("  ✓ proof/demo-timeline.png");

await page.goto(`${SITE}/status`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("status-desktop.png", { fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${SITE}/demo`, { waitUntil: "networkidle" });
await shot("demo-mobile.png");

await browser.close();
