import "server-only";
import { randomBytes } from "node:crypto";
import { normalizeAddress } from "@splitsense/chain";
import { allocate, buildFlatView, koboToMicroUsdc, type Category, type Expense, type Ledger, type LocalDate, type Payment } from "@splitsense/engine";
import { z } from "zod";
import { env } from "@/env";
import { usdc } from "@/lib/format";
import { pool } from "@/server/db";
import { demoAsOf, demoGroupId, demoLedger, getPayments, type PaymentRow } from "@/server/demo";
import { AppError } from "@/server/http";
import fixture from "../../../../fixtures/lagos-flat.json";

export const GROUP_KINDS = ["flat", "event"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const CATEGORIES: Record<GroupKind, Category[]> = {
  flat: ["power", "fuel", "data", "groceries", "housing", "utilities", "other"],
  event: ["food", "transport", "tickets", "stay", "groceries", "other"],
};

const MAX_MEMBERS = 50;
const MAX_GROUPS_PER_DAY = 20;
const MAX_BILL_KOBO = 10_000_000_000n;
const INVITE_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export const displayName = z
  .string()
  .trim()
  .min(1, "enter a name")
  .max(32, "keep it under 32 characters")
  .regex(/^[^\p{C}<>]+$/u, "letters, numbers and spaces only");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Today in Lagos, which is the day bills are dated in. */
export const lagosToday = (): LocalDate => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const lagosDay = (iso: string): LocalDate => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

function inviteCode() {
  const bytes = randomBytes(10);
  return [...bytes].map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

/** One share each, so a three-way split is exact thirds to the kobo. */
const equalShares = (memberIds: string[]) => Object.fromEntries([...new Set(memberIds)].map((id) => [id, 1]));

export interface GroupMember {
  id: string;
  name: string;
  address: string | null;
}

interface StoredExpense extends Expense {
  addedBy: string | null;
}

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  place: string | null;
  rate: number;
  /** The seeded sample flat: read-only, its memory already lives on Walrus. */
  demo: boolean;
  inviteCode: string | null;
  members: GroupMember[];
  expenses: StoredExpense[];
  payments: PaymentRow[];
  ledger: Ledger;
  asOf: LocalDate;
}

async function loadDemo(): Promise<Group> {
  const [{ rows: links }, paid] = await Promise.all([
    pool.query(`SELECT address, member_key FROM wallet_links WHERE group_key = $1`, [demoGroupId]),
    getPayments(demoGroupId),
  ]);
  const addressOf = new Map(links.map((l) => [l.member_key as string, l.address as string]));
  const payments = paid.map((p): Payment => {
    const day = p.settledAt.slice(0, 10);
    return { id: p.digest, from: p.from, to: p.to, amountMinor: p.amountMinor, paidOn: day < demoAsOf ? day : demoAsOf };
  });
  return {
    id: demoGroupId,
    name: fixture.group.name,
    kind: "flat",
    place: fixture.group.address,
    rate: fixture.group.rateNgnPerUsdc,
    demo: true,
    inviteCode: null,
    members: demoLedger.members.map((m) => ({ id: m.id, name: m.displayName, address: addressOf.get(m.id) ?? null })),
    expenses: demoLedger.expenses.map((e) => ({ ...e, addedBy: null })),
    payments: paid,
    ledger: { ...demoLedger, payments },
    asOf: demoAsOf,
  };
}

async function loadStored(id: string): Promise<Group | null> {
  const { rows: groups } = await pool.query(`SELECT id, name, kind, place, rate_ngn_per_usdc, invite_code FROM groups WHERE id = $1`, [id]);
  const g = groups[0];
  if (!g) return null;
  const [{ rows: members }, { rows: expenses }, paid] = await Promise.all([
    pool.query(`SELECT id, display_name, sui_address FROM members WHERE group_id = $1 ORDER BY created_at, id`, [id]),
    pool.query(
      `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, amount_minor, payer_id, category, description, split, added_by
       FROM expenses WHERE group_id = $1 ORDER BY date, created_at, id`,
      [id],
    ),
    getPayments(id),
  ]);
  const list: GroupMember[] = members.map((m) => ({ id: m.id, name: m.display_name, address: m.sui_address }));
  const stored = expenses.map(
    (e): StoredExpense => ({
      id: e.id,
      date: e.date,
      amountMinor: BigInt(e.amount_minor),
      currency: "NGN",
      payerId: e.payer_id,
      category: e.category as Category,
      description: e.description,
      split: e.split,
      addedBy: e.added_by,
    }),
  );
  const asOf = lagosToday();
  const payments = paid.map((p): Payment => ({ id: p.digest, from: p.from, to: p.to, amountMinor: p.amountMinor, paidOn: lagosDay(p.settledAt) }));
  return {
    id: g.id,
    name: g.name,
    kind: g.kind as GroupKind,
    place: g.place,
    rate: g.rate_ngn_per_usdc,
    demo: false,
    inviteCode: g.invite_code,
    members: list,
    expenses: stored,
    payments: paid,
    ledger: { members: list.map((m) => ({ id: m.id, displayName: m.name })), expenses: stored, settlements: [], payments },
    asOf,
  };
}

export async function loadGroup(id: string): Promise<Group | null> {
  if (id === demoGroupId) return loadDemo();
  return UUID.test(id) ? loadStored(id) : null;
}

/** The group, and the member the signed-in wallet is in it; 404 for outsiders so ids don't leak. */
export async function groupAs(id: string, address: string) {
  const group = await loadGroup(id);
  const me = group?.members.find((m) => m.address === normalizeAddress(address));
  if (!group || !me) throw new AppError("that group doesn't exist or you're not in it", 404);
  return { group, me };
}

/** Net balance, and who pays whom, for one member after confirmed payments. */
export function balancesFor(group: Group, meId: string) {
  const view = buildFlatView(group.ledger, group.asOf);
  const rate = BigInt(group.rate);
  const member = (id: string) => group.members.find((m) => m.id === id);
  const row = (memberId: string, amountMinor: bigint) => ({
    memberId,
    name: member(memberId)?.name ?? memberId,
    address: member(memberId)?.address ?? null,
    amountMinor,
    microUsdc: koboToMicroUsdc(amountMinor, rate),
  });
  return {
    view,
    net: view.balances.find((b) => b.memberId === meId)?.netMinor ?? 0n,
    owe: view.transfers.filter((t) => t.from === meId).map((t) => row(t.to, t.amountMinor)),
    owed: view.transfers.filter((t) => t.to === meId).map((t) => row(t.from, t.amountMinor)),
  };
}

export const memoryOn = (group: Group) => group.demo || env.MEMORY_USER_GROUPS === "on";

/** Everything the group screen shows the signed-in member. */
export async function groupView(id: string, address: string) {
  const { group, me } = await groupAs(id, address);
  const { view, net, owe, owed } = balancesFor(group, me.id);
  const name = (memberId: string) => group.members.find((m) => m.id === memberId)?.name ?? memberId;
  const bills = group.expenses
    .toReversed()
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      category: e.category,
      amountMinor: e.amountMinor,
      payer: { id: e.payerId, name: name(e.payerId) },
      shareMinor: allocate(e.amountMinor, e.split).get(me.id) ?? 0n,
      people: Object.keys(e.split).length,
      mine: e.addedBy === me.id,
    }));
  return {
    id: group.id,
    name: group.name,
    kind: group.kind,
    place: group.place,
    rate: group.rate,
    demo: group.demo,
    memory: memoryOn(group),
    invite: group.inviteCode,
    asOf: group.asOf,
    categories: CATEGORIES[group.kind],
    me,
    members: group.members.map((m) => ({ ...m, net: view.balances.find((b) => b.memberId === m.id)?.netMinor ?? 0n })),
    net,
    owe,
    owed,
    spentMinor: group.expenses.reduce((s, e) => s + e.amountMinor, 0n),
    billCount: group.expenses.length,
    bills,
    payments: group.payments.slice(0, 10).map((p) => ({ ...p, fromName: name(p.from), toName: name(p.to) })),
    turns: view.turns.map((t) => ({ category: t.category, nextPayerId: t.nextPayerId, summary: t.explanation.summary })),
    upcoming: view.upcoming.map((u) => ({ category: u.category, nextExpectedDate: u.nextExpectedDate, expectedAmountMinor: u.expectedAmountMinor, summary: u.explanation.summary })),
  };
}

/** Ids of the groups a wallet belongs to: the demo flat through its wallet link, the rest by membership. */
async function groupIdsFor(address: string): Promise<string[]> {
  const a = normalizeAddress(address);
  const [{ rows: demo }, { rows: stored }] = await Promise.all([
    pool.query(`SELECT 1 FROM wallet_links WHERE address = $1 AND group_key = $2`, [a, demoGroupId]),
    pool.query(`SELECT m.group_id FROM members m JOIN groups g ON g.id = m.group_id WHERE m.sui_address = $1 ORDER BY g.created_at DESC`, [a]),
  ]);
  return [...stored.map((r) => r.group_id as string), ...(demo.length ? [demoGroupId] : [])];
}

/** Every group the wallet is in, loaded, with the member it is in each. */
export async function memberships(address: string) {
  return Promise.all((await groupIdsFor(address)).map((id) => groupAs(id, address)));
}

export async function myGroups(address: string) {
  return (await memberships(address)).map(({ group, me }) => {
    const { net, owe, owed } = balancesFor(group, me.id);
    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      place: group.place,
      demo: group.demo,
      rate: group.rate,
      me,
      members: group.members.map((m) => ({ id: m.id, name: m.name })),
      net,
      owe,
      owed,
      billCount: group.expenses.length,
    };
  });
}

export async function getProfile(address: string) {
  const a = normalizeAddress(address);
  const { rows } = await pool.query(`SELECT display_name FROM profiles WHERE address = $1`, [a]);
  if (rows[0]) return { name: rows[0].display_name as string, suggested: null };
  const { rows: demo } = await pool.query(`SELECT member_key FROM wallet_links WHERE address = $1`, [a]);
  const suggested = demoLedger.members.find((m) => m.id === demo[0]?.member_key)?.displayName ?? null;
  return { name: null, suggested };
}

/** Sets the wallet's name everywhere it's a member. */
export async function setProfileName(address: string, name: string) {
  const a = normalizeAddress(address);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO profiles (address, display_name) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
      [a, name],
    );
    await client.query(`UPDATE members SET display_name = $2 WHERE sui_address = $1`, [a, name]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { name };
}

async function requireName(address: string) {
  const { name } = await getProfile(address);
  if (!name) throw new AppError("choose the name your friends will see first", 409);
  return name;
}

export const newGroup = z.object({
  name: z.string().trim().min(1, "give it a name").max(48, "keep the name under 48 characters"),
  kind: z.enum(GROUP_KINDS),
  place: z.string().trim().max(80).optional().transform((p) => p || null),
  rate: z.number().int().min(100).max(100_000).default(fixture.group.rateNgnPerUsdc),
});

export async function createGroup(address: string, input: z.infer<typeof newGroup>) {
  const a = normalizeAddress(address);
  const name = await requireName(a);
  const { rows: recent } = await pool.query(`SELECT count(*)::int AS n FROM groups WHERE created_by = $1 AND created_at > now() - interval '1 day'`, [a]);
  if (recent[0].n >= MAX_GROUPS_PER_DAY) throw new AppError("that's a lot of new groups today; try again tomorrow", 429);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO groups (name, kind, place, rate_ngn_per_usdc, invite_code, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.name, input.kind, input.place, input.rate, inviteCode(), a],
    );
    const id = rows[0].id as string;
    await client.query(`INSERT INTO members (group_id, display_name, sui_address) VALUES ($1, $2, $3)`, [id, name, a]);
    await client.query("COMMIT");
    return { id };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** What someone holding an invite link sees before joining. No addresses. */
export async function invitePreview(code: string) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.kind, g.place, array_agg(m.display_name ORDER BY m.created_at) AS names
     FROM groups g JOIN members m ON m.group_id = g.id WHERE g.invite_code = $1 GROUP BY g.id`,
    [code],
  );
  const g = rows[0];
  if (!g) throw new AppError("this invite link isn't valid anymore; ask for a new one", 404);
  return { id: g.id as string, name: g.name as string, kind: g.kind as GroupKind, place: g.place as string | null, members: g.names as string[] };
}

export async function joinGroup(address: string, code: string) {
  const a = normalizeAddress(address);
  const name = await requireName(a);
  const { id, members } = await invitePreview(code);
  const { rows: existing } = await pool.query(`SELECT 1 FROM members WHERE group_id = $1 AND sui_address = $2`, [id, a]);
  if (existing.length) return { id, joined: false };
  if (members.length >= MAX_MEMBERS) throw new AppError(`groups are capped at ${MAX_MEMBERS} people`, 409);
  await pool.query(`INSERT INTO members (group_id, display_name, sui_address) VALUES ($1, $2, $3) ON CONFLICT (group_id, sui_address) DO NOTHING`, [id, name, a]);
  return { id, joined: true };
}

/** A fresh invite link; the old one stops working. */
export async function rotateInvite(id: string, address: string) {
  const { group } = await groupAs(id, address);
  if (group.demo) throw new AppError("the sample flat doesn't take new members", 403);
  const code = inviteCode();
  await pool.query(`UPDATE groups SET invite_code = $2 WHERE id = $1`, [id, code]);
  return { invite: code };
}

export const newBill = z.object({
  description: z.string().trim().min(1, "say what it was for").max(60, "keep the description under 60 characters"),
  amountMinor: z
    .string()
    .regex(/^\d{1,13}$/, "enter an amount")
    .transform((s) => BigInt(s)),
  category: z.string(),
  payerId: z.string(),
  participantIds: z.array(z.string()).min(1, "pick who it's split between").max(MAX_MEMBERS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date"),
});

export async function addBill(id: string, address: string, input: z.infer<typeof newBill>) {
  const { group, me } = await groupAs(id, address);
  if (group.demo) throw new AppError("the sample flat is read-only", 403);
  const ids = new Set(group.members.map((m) => m.id));
  if (!ids.has(input.payerId)) throw new AppError("whoever paid has to be in the group");
  if (!input.participantIds.every((p) => ids.has(p))) throw new AppError("everyone sharing the bill has to be in the group");
  if (!(CATEGORIES[group.kind] as string[]).includes(input.category)) throw new AppError("pick one of the categories");
  if (input.amountMinor < BigInt(group.rate) || input.amountMinor > MAX_BILL_KOBO) throw new AppError(`bills go from 0.01 USDC to ${usdc(MAX_BILL_KOBO, group.rate)}`);
  const today = lagosToday();
  if (input.date > today) throw new AppError("a bill can't be dated in the future");
  if (input.date < `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`) throw new AppError("bills older than a year can't be added");
  const { rows } = await pool.query(
    `INSERT INTO expenses (group_id, date, amount_minor, payer_id, category, description, split, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [id, input.date, input.amountMinor, input.payerId, input.category, input.description, equalShares(input.participantIds), me.id],
  );
  return { id: rows[0].id as string };
}

/** Only whoever added a bill can remove it. */
export async function deleteBill(id: string, billId: string, address: string) {
  const { group, me } = await groupAs(id, address);
  if (group.demo || !UUID.test(billId)) throw new AppError("that bill can't be removed", 403);
  const { rowCount } = await pool.query(`DELETE FROM expenses WHERE id = $1 AND group_id = $2 AND added_by = $3`, [billId, id, me.id]);
  if (!rowCount) throw new AppError("only whoever added a bill can remove it", 403);
  return { removed: billId };
}
