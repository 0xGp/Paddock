// Drives sign-in, names, groups, invites and bills through the app API with the demo wallets, the way
// three friends would from their browsers. Nothing touches the chain or Walrus.
// usage: node --env-file=.env.local scripts/groups-e2e.mjs [base=http://localhost:3100] [--keep]
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import pg from "pg";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const keypair = (name) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(process.env[name]).secretKey);

/** One browser: its own cookie jar. */
function browser(key) {
  const jar = new Map();
  const kp = key ? keypair(key) : Ed25519Keypair.generate();
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || !v) jar.delete(k);
      else jar.set(k, v);
    }
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const signIn = async (signer = kp) => {
    const { body } = await call("POST", "/api/auth/challenge", { address: kp.toSuiAddress() });
    const signed = await signer.signPersonalMessage(new TextEncoder().encode(body.message));
    return call("POST", "/api/auth/verify", { address: kp.toSuiAddress(), bytes: signed.bytes, signature: signed.signature });
  };
  return { kp, address: kp.toSuiAddress(), call, signIn, jar };
}

let failed = 0;
const check = (label, got, status, test = () => true) => {
  const ok = got.status === status && test(got.body);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${got.status}${ok ? "" : ` ${JSON.stringify(got.body).slice(0, 200)}`}`);
  return got.body;
};
const naira = (kobo) => `₦${(Number(kobo) / 100).toLocaleString("en-NG")}`;

const gp = browser("SUI_PAYEE_PRIVATE_KEY");
const ada = browser("SUI_ADA_PRIVATE_KEY");
const tolu = browser("SUI_TOLU_PRIVATE_KEY");
const stranger = browser();

console.log("— sign-in");
check("no session yet", await gp.call("GET", "/api/me"), 401);
check("signed by another wallet is refused", await stranger.signIn(gp.kp), 401);
check("Godspower signs in", await gp.signIn(), 200, (b) => b.address === gp.address);
check("challenge can't be replayed", await gp.call("POST", "/api/auth/verify", { address: gp.address, bytes: "AA==", signature: "AA==" }), 401);
check("session reads back", await gp.call("GET", "/api/auth/session"), 200, (b) => b.address === gp.address);
check("forged session cookie is refused", await stranger.call("GET", "/api/me", undefined, { cookie: `ss_session=${gp.address}.${Date.now() + 1e9}.forged` }), 401);
check("Ada signs in", await ada.signIn(), 200);
check("Tolu signs in", await tolu.signIn(), 200);
check("a fresh wallet signs in", await stranger.signIn(), 200);

console.log("— names");
check("blank name is refused", await gp.call("PUT", "/api/me", { name: "  " }), 400);
check("markup in a name is refused", await gp.call("PUT", "/api/me", { name: "<b>GP</b>" }), 400);
for (const [b, name] of [[gp, "Godspower"], [ada, "Ada"], [tolu, "Tolu"]]) check(`${name} sets a name`, await b.call("PUT", "/api/me", { name }), 200);
check("creating a group needs a name first", await stranger.call("POST", "/api/groups", { name: "x", kind: "event", rate: 1500 }), 409);

console.log("— create and invite");
check("cross-site create is refused", await gp.call("POST", "/api/groups", { name: "x", kind: "event", rate: 1500 }, { "sec-fetch-site": "cross-site" }), 403);
check("unknown kind is refused", await gp.call("POST", "/api/groups", { name: "x", kind: "club", rate: 1500 }), 400);
const { id } = check("Godspower creates an event", await gp.call("POST", "/api/groups", { name: "Ilashe beach day", kind: "event", place: "Ilashe, 14 Dec", rate: 1500 }), 200);
const g0 = check("he sees it with an invite code", await gp.call("GET", `/api/groups/${id}`), 200, (b) => b.invite && b.members.length === 1 && b.kind === "event");
check("an outsider can't open it", await stranger.call("GET", `/api/groups/${id}`), 404);
check("invite preview shows first names only", await stranger.call("GET", `/api/invites/${g0.invite}`), 200, (b) => b.name === "Ilashe beach day" && !JSON.stringify(b).includes("0x"));
check("a made-up invite is refused", await stranger.call("GET", "/api/invites/notarealcode"), 404);
check("joining without a session is refused", await browser().call("POST", `/api/invites/${g0.invite}`), 401);
check("Ada joins", await ada.call("POST", `/api/invites/${g0.invite}`), 200, (b) => b.id === id && b.joined);
check("joining twice is harmless", await ada.call("POST", `/api/invites/${g0.invite}`), 200, (b) => !b.joined);
check("Tolu joins", await tolu.call("POST", `/api/invites/${g0.invite}`), 200);

console.log("— bills");
const g1 = check("all three are in", await gp.call("GET", `/api/groups/${id}`), 200, (b) => b.members.length === 3);
const m = Object.fromEntries(g1.members.map((x) => [x.name, x.id]));
const today = g1.asOf;
const bill = (payer, kobo, description, category, who = Object.values(m)) => ({ description, amountMinor: String(kobo), category, payerId: m[payer], participantIds: who, date: today });
check("a flat category on an event is refused", await gp.call("POST", `/api/groups/${id}/bills`, bill("Godspower", 3_000_000, "Diesel", "fuel")), 400);
check("a future date is refused", await gp.call("POST", `/api/groups/${id}/bills`, { ...bill("Godspower", 3_000_000, "Boat", "transport"), date: "2099-01-01" }), 400);
check("a stranger as payer is refused", await gp.call("POST", `/api/groups/${id}/bills`, { ...bill("Godspower", 3_000_000, "Boat", "transport"), payerId: "00000000-0000-0000-0000-000000000000" }), 400);
check("an outsider can't add bills", await stranger.call("POST", `/api/groups/${id}/bills`, bill("Godspower", 3_000_000, "Boat", "transport")), 404);
check("the sample flat is read-only", await gp.call("POST", "/api/groups/flat-3b/bills", bill("Godspower", 100, "x", "other")), 403);
const boat = check("Godspower adds the ₦30,000 boat for all three", await gp.call("POST", `/api/groups/${id}/bills`, bill("Godspower", 3_000_000, "Boat to Ilashe", "transport")), 200);
check("Ada adds ₦9,000 of food for all three", await ada.call("POST", `/api/groups/${id}/bills`, bill("Ada", 900_000, "Suya and drinks", "food")), 200);
check("Tolu adds ₦4,000 tickets for Tolu and Ada", await tolu.call("POST", `/api/groups/${id}/bills`, bill("Tolu", 400_000, "Beach entry", "tickets", [m.Tolu, m.Ada])), 200);
check("Ada can't remove Godspower's bill", await ada.call("DELETE", `/api/groups/${id}/bills/${boat.id}`), 403);

console.log("— balances");
// Boat: GP +20k, Ada −10k, Tolu −10k. Food: Ada +6k, GP −3k, Tolu −3k. Tickets: Tolu +2k, Ada −2k.
// Net: GP +17,000, Ada −6,000, Tolu −11,000.
const want = { Godspower: 1_700_000n, Ada: -600_000n, Tolu: -1_100_000n };
const g2 = check("nets come out right", await tolu.call("GET", `/api/groups/${id}`), 200, (b) => b.members.every((x) => BigInt(x.net) === want[x.name]));
for (const x of g2.members) console.log(`     ${x.name.padEnd(10)} ${BigInt(x.net) < 0n ? "owes" : "owed"} ${naira(BigInt(x.net) < 0n ? -BigInt(x.net) : BigInt(x.net))}`);
check("Tolu pays Godspower ₦11,000", { status: 200, body: g2 }, 200, (b) => b.owe.length === 1 && b.owe[0].name === "Godspower" && b.owe[0].amountMinor === "1100000" && b.owe[0].microUsdc === "7333333");
const home = check("Godspower's home lists the group", await gp.call("GET", "/api/me"), 200, (b) => b.groups.some((x) => x.id === id && x.net === "1700000"));
console.log(`     his groups: ${home.groups.map((x) => x.name).join(", ")}`);
check("settling builds against the group's debts", await tolu.call("POST", "/api/settle/prepare", { address: tolu.address, group: id, to: m.Godspower, microUsdc: "8000000" }), 400, (b) => /more than/.test(b.error));

console.log("— rotate and leave no trace");
const { invite } = check("a new invite link", await gp.call("POST", `/api/groups/${id}/invite`), 200);
check("the old link stops working", await stranger.call("GET", `/api/invites/${g0.invite}`), 404);
check("the new one works", await stranger.call("GET", `/api/invites/${invite}`), 200);
check("signing out", await gp.call("DELETE", "/api/auth/session"), 200);
check("then /api/me is refused", await gp.call("GET", "/api/me"), 401);

if (!args.includes("--keep")) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("DELETE FROM groups WHERE id = $1", [id]);
  await db.query("DELETE FROM profiles WHERE address = $1", [stranger.address]);
  await db.end();
  console.log("cleaned up the test group");
} else console.log(`kept: ${base}/app/g/${id}  invite: ${base}/join/${invite}`);

console.log(failed ? `${failed} FAILED` : "all passed");
process.exitCode = failed ? 1 : 0;
