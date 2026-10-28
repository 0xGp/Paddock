// Deterministic seed data for "Flat 3B" (SPEC §7). Run: node scripts/make-fixture.mjs
// The PRNG only decides settle delays here; the engine itself never uses randomness.
import { writeFileSync } from "node:fs";

const NOW = "2026-11-01";
const MEMBERS = [
  { id: "godspower", displayName: "Godspower", names: ["Godspower", "GP"] },
  { id: "tolu", displayName: "Tolu", names: ["Tolu"] },
  { id: "ada", displayName: "Ada", names: ["Ada"] },
  { id: "emeka", displayName: "Emeka", names: ["Emeka", "Meks"] },
];
const EVERYONE = { ada: 2500, emeka: 2500, godspower: 2500, tolu: 2500 };
const NO_EMEKA = { godspower: 4000, tolu: 3000, ada: 3000 };

/** [date, naira, payer, description, category, split?] */
const ROWS = [
  ["2026-08-01", 50_000, "godspower", "Service charge", "housing"],
  ["2026-09-01", 50_000, "godspower", "Service charge", "housing"],
  ["2026-10-01", 50_000, "godspower", "Service charge", "housing"],

  ["2026-08-03", 5_000, "godspower", "LAWMA waste", "utilities"],
  ["2026-09-02", 5_000, "godspower", "LAWMA waste", "utilities"],
  ["2026-10-02", 5_000, "godspower", "LAWMA waste", "utilities"],

  ["2026-08-02", 25_000, "tolu", "Generator diesel", "fuel"],
  ["2026-08-09", 24_000, "tolu", "Generator diesel", "fuel"],
  ["2026-08-16", 26_000, "tolu", "Generator diesel", "fuel"],
  ["2026-08-23", 25_000, "tolu", "Generator diesel", "fuel"],
  ["2026-08-30", 27_000, "tolu", "Generator diesel", "fuel"],
  ["2026-09-06", 25_000, "ada", "Generator diesel", "fuel"],
  ["2026-09-13", 26_000, "tolu", "Generator diesel", "fuel"],
  ["2026-09-20", 24_000, "tolu", "Generator diesel", "fuel"],
  ["2026-09-27", 25_000, "tolu", "Generator diesel", "fuel"],
  ["2026-10-04", 25_000, "emeka", "Generator diesel", "fuel"],
  ["2026-10-11", 26_000, "emeka", "Generator diesel", "fuel"],
  ["2026-10-18", 25_000, "tolu", "Generator diesel", "fuel"],
  ["2026-10-25", 24_000, "tolu", "Generator diesel", "fuel"],

  ["2026-08-05", 40_000, "godspower", "IKEDC prepaid token", "power"],
  ["2026-08-19", 38_000, "tolu", "IKEDC prepaid token", "power"],
  ["2026-09-02", 42_000, "ada", "IKEDC prepaid token", "power"],
  ["2026-09-16", 36_000, "emeka", "IKEDC prepaid token", "power"],
  ["2026-09-30", 40_000, "godspower", "IKEDC prepaid token", "power"],
  ["2026-10-14", 44_000, "tolu", "IKEDC prepaid token", "power"],
  ["2026-10-28", 39_000, "ada", "IKEDC prepaid token", "power"],

  ["2026-08-05", 30_000, "ada", "Spectranet data", "data"],
  ["2026-09-05", 30_000, "ada", "Spectranet data", "data"],
  ["2026-10-06", 30_000, "ada", "Spectranet data", "data"],

  ["2026-08-08", 38_000, "godspower", "Shoprite run", "groceries"],
  ["2026-08-21", 24_000, "ada", "Lekki market foodstuff", "groceries"],
  ["2026-09-04", 52_000, "tolu", "Shoprite run", "groceries"],
  ["2026-09-18", 18_000, "emeka", "Lekki market foodstuff", "groceries"],
  ["2026-09-26", 92_000, "godspower", "Party run, Shoprite", "groceries"],
  ["2026-10-03", 41_000, "godspower", "Shoprite run", "groceries", NO_EMEKA],
  ["2026-10-17", 33_000, "ada", "Lekki market foodstuff", "groceries", NO_EMEKA],
  ["2026-10-24", 45_000, "tolu", "Shoprite run", "groceries", NO_EMEKA],
];

/** Settle-delay ranges in days per member (SPEC §7). */
const DELAY = { godspower: [0, 2], tolu: [3, 4], ada: [4, 6], emeka: [6, 11] };

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261101);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const sorted = [...ROWS].sort((a, b) => (a[0] === b[0] ? a[3].localeCompare(b[3]) : a[0] < b[0] ? -1 : 1));
const expenses = sorted.map(([date, naira, payerId, description, category, split], i) => ({
  id: `e${String(i + 1).padStart(3, "0")}`,
  date,
  amountMinor: String(naira * 100),
  currency: "NGN",
  payerId,
  category,
  description,
  split: split ?? EVERYONE,
}));

const settlements = [];
for (const e of expenses) {
  for (const memberId of Object.keys(e.split).sort()) {
    if (memberId === e.payerId || e.split[memberId] === 0) continue;
    const [lo, hi] = DELAY[memberId];
    const settledOn = addDays(e.date, lo + Math.floor(rand() * (hi - lo + 1)));
    if (settledOn <= NOW) settlements.push({ expenseId: e.id, memberId, settledOn });
  }
}
settlements.sort((a, b) => (a.settledOn === b.settledOn ? a.expenseId.localeCompare(b.expenseId) || a.memberId.localeCompare(b.memberId) : a.settledOn < b.settledOn ? -1 : 1));

const fixture = {
  synthetic: true,
  group: { id: "flat-3b", name: "Flat 3B", address: "Admiralty Way, Lekki Phase 1", rateNgnPerUsdc: 1500 },
  now: NOW,
  members: MEMBERS,
  expenses,
  settlements,
};
writeFileSync(new URL("../fixtures/lagos-flat.json", import.meta.url), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`fixtures/lagos-flat.json: ${expenses.length} expenses, ${settlements.length} settlements, now=${NOW}`);
