// Screenshot at an exact viewport width via headless Chrome + CDP.
// usage: node scripts/shoot.mjs <url> <out.png> <width> [scale] [--wallet=0x…] [--eval=js] [--height=900]
//   --wallet  injects a read-only preview wallet (wallet-standard) that is already connected
//   --eval    runs in the page after load, e.g. to open a modal or move a slider
//   --fresh=1 with --wallet: the wallet is installed but not connected yet
//   --height  fixed viewport height; without it the shot is the full page
//   --fit=1   full page cropped to the body, even when it's shorter than the viewport
//   --wait    ms to wait after load (default 4000)
//   --session=KEY_VAR|new  signs in from Node with that key (or a fresh one) and gives the browser only
//             the session cookie, with a preview wallet for the same address. Needs --env-file.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => [a.slice(2, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
const [url, out, width = "390", scale = "2"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const cookieOf = (r, name) => r.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0];
let session;
if (flags.session) {
  const kp = flags.session === "new" ? Ed25519Keypair.generate() : Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(process.env[flags.session]).secretKey);
  const origin = new URL(url).origin;
  const post = (path, body, cookie) => fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie && { cookie }) }, body: JSON.stringify(body) });
  const challenge = await post("/api/auth/challenge", { address: kp.toSuiAddress() });
  const signed = await kp.signPersonalMessage(new TextEncoder().encode((await challenge.json()).message));
  const verified = await post("/api/auth/verify", { address: kp.toSuiAddress(), bytes: signed.bytes, signature: signed.signature }, cookieOf(challenge, "ss_nonce"));
  session = cookieOf(verified, "ss_session");
  if (!session) throw new Error(`sign-in failed: ${verified.status}`);
  flags.wallet = kp.toSuiAddress();
}
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "shoot-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const previewWallet = (address) => `(() => {
  const account = { address: ${JSON.stringify(address)}, publicKey: new Uint8Array(32), chains: ["sui:mainnet"], features: ["sui:signTransaction"] };
  const icon = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#4da2ff"/><circle cx="20" cy="20" r="8" fill="#fff"/></svg>');
  const wallet = {
    version: "1.0.0", name: "Preview Wallet", icon, chains: ["sui:mainnet"], accounts: [account],
    features: {
      "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
      "standard:events": { version: "1.0.0", on: () => () => {} },
      "sui:signTransaction": { version: "2.0.0", signTransaction: async () => { throw new Error("The preview wallet can't sign."); } },
    },
  };
  if (${!("fresh" in flags)}) localStorage.setItem("splitsense.wallet", JSON.stringify({ name: wallet.name, address: account.address }));
  const cb = ({ register }) => register(wallet);
  try { window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: cb })); } catch {}
  window.addEventListener("wallet-standard:app-ready", ({ detail }) => cb(detail));
})();`;

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page")).catch(() => undefined);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg), pending.delete(msg.id);
  });
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

  const w = Number(width);
  const metrics = { width: w, height: Number(flags.height ?? 900), deviceScaleFactor: Number(scale), mobile: w < 768 };
  await send("Emulation.setDeviceMetricsOverride", metrics);
  await send("Page.enable");
  if (flags.wallet) await send("Page.addScriptToEvaluateOnNewDocument", { source: previewWallet(flags.wallet) });
  if (session) {
    const [name, value] = session.split("=");
    await send("Network.enable");
    await send("Network.setCookie", { name, value, url: new URL(url).origin, httpOnly: true });
  }
  await send("Page.navigate", { url });
  await sleep(Number(flags.wait ?? 4000));
  if (flags.eval) {
    await send("Runtime.evaluate", { expression: flags.eval, awaitPromise: true });
    await sleep(1200);
  }
  if (!flags.height) {
    const expression = "fit" in flags ? "Math.ceil(document.body.getBoundingClientRect().height)" : "document.documentElement.scrollHeight";
    const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
    await send("Emulation.setDeviceMetricsOverride", { ...metrics, height: result.result.value });
    await sleep(300);
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  ws.close();
} finally {
  chrome.kill();
}
