// Creates the demo flat's wallets once, one per flatmate. Private keys go only into the
// git-ignored .env.local; this prints public addresses. Import a key into Slush with
// "Import private key" to use the same account in the browser.
import { appendFileSync, readFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

const FILE = new URL("../.env.local", import.meta.url);
const ROLES = [
  ["SUI_PAYER_PRIVATE_KEY", "payer (Emeka in the demo)"],
  ["SUI_PAYEE_PRIVATE_KEY", "payee (Godspower in the demo)"],
  ["SUI_ADA_PRIVATE_KEY", "Ada in the demo"],
  ["SUI_TOLU_PRIVATE_KEY", "Tolu in the demo"],
];

const text = readFileSync(FILE, "utf8");
const existing = (name) => text.match(new RegExp(`^${name}=(\\S+)`, "m"))?.[1];
const added = [];

for (const [name, role] of ROLES) {
  let key = existing(name);
  if (!key) {
    key = Ed25519Keypair.generate().getSecretKey();
    added.push(`${name}=${key}`);
  }
  const address = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(key).secretKey).toSuiAddress();
  console.log(`${role.padEnd(30)} ${address}${added.some((l) => l.startsWith(name)) ? "  (new)" : ""}`);
}

if (added.length) appendFileSync(FILE, `${text.endsWith("\n") ? "" : "\n"}\n# Demo flat wallets (scripts/sui-keys.mjs). SERVER/SCRIPTS ONLY.\n${added.join("\n")}\n`);
