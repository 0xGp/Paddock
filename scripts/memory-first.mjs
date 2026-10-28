// M0: write one app-level marker memory to Mainnet in the SPLITSENSE v1 envelope, then recall it.
// Run: node --env-file=.env.local scripts/memory-first.mjs
import { createHash } from "node:crypto";
import { MemWal } from "@mysten-incubation/memwal";

const canonical = (value) =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : `{${Object.keys(value)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
        .join(",")}}`;

const memwal = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
});

const at = new Date().toISOString();
const payload = { event: "m0_first_mainnet_memory", note: "SplitSense is live on Walrus Memory Mainnet", prev: null, rulesetVersion: "v1" };
const hash = createHash("sha256").update(canonical(payload)).digest("hex");
const text = `SPLITSENSE v1 | kind=app_marker | group=ss_app | seq=1 | at=${at}\n${canonical({ ...payload, hash })}`;

const written = await memwal.rememberAndWait(text, "ss_app");
console.log("written:", JSON.stringify(written));

const recalled = await memwal.recall({ query: "SPLITSENSE v1 kind=app_marker group=ss_app", namespace: "ss_app", limit: 3 });
console.log("recalled:", JSON.stringify(recalled).slice(0, 600));
memwal.destroy();
