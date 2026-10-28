import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** The name a wallet goes by. The wallet is the account (ADR-0012). */
export const profiles = pgTable("profiles", {
  address: text("address").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** `flat` for an ongoing household, `event` for a trip, party or one-off. */
  kind: text("kind").notNull().default("flat"),
  /** Area for a flat, venue or dates for an event. */
  place: text("place"),
  baseCurrency: text("base_currency").notNull().default("NGN"),
  rateNgnPerUsdc: integer("rate_ngn_per_usdc").notNull(),
  /** Anyone holding this code can join; members can rotate it to cut off old links. */
  inviteCode: text("invite_code").unique(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    suiAddress: text("sui_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("members_group_idx").on(t.groupId), uniqueIndex("members_group_address_idx").on(t.groupId, t.suiAddress), index("members_address_idx").on(t.suiAddress)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("NGN"),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => members.id),
    category: text("category").notNull(),
    description: text("description").notNull(),
    /** memberId → basis points, summing to 10_000. */
    split: jsonb("split").$type<Record<string, number>>().notNull(),
    addedBy: uuid("added_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expenses_group_date_idx").on(t.groupId, t.date)],
);

/** Which flat member a Sui address is. The wallet is the identity (ADR-0012); keys are fixture ids. */
export const walletLinks = pgTable(
  "wallet_links",
  {
    address: text("address").primaryKey(),
    groupKey: text("group_key").notNull(),
    memberKey: text("member_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallet_links_member_idx").on(t.groupKey, t.memberKey)],
);

/** USDC settlements confirmed through Tatum; each also becomes a settlement_receipt memory. */
export const payments = pgTable(
  "payments",
  {
    digest: text("digest").primaryKey(),
    groupKey: text("group_key").notNull(),
    fromMember: text("from_member").notNull(),
    toMember: text("to_member").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    microUsdc: bigint("micro_usdc", { mode: "bigint" }).notNull(),
    /** Naira kobo at the group rate when paid. */
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    coinType: text("coin_type").notNull(),
    checkpoint: bigint("checkpoint", { mode: "number" }),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),
    confirmMs: integer("confirm_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_group_idx").on(t.groupKey, t.settledAt)],
);

/** Raw texts last recalled from Walrus per namespace; re-verified on every read (brick 3). */
export const memorySnapshots = pgTable("memory_snapshots", {
  namespace: text("namespace").primaryKey(),
  recalled: jsonb("recalled").$type<{ text: string; blob_id: string; created_at: string | null }[]>().notNull(),
  recalledAt: timestamp("recalled_at", { withTimezone: true }).notNull(),
  recallMs: integer("recall_ms").notNull(),
  relayerCount: integer("relayer_count"),
  degraded: boolean("degraded").notNull().default(false),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
});

export const memoryOutbox = pgTable(
  "memory_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    namespace: text("namespace").notNull(),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    /** Position on the (namespace, kind) chain; `prev` in the envelope is the previous row's hash. */
    seq: integer("seq").notNull(),
    /** Envelope hash (ADR-0006). */
    contentHash: text("content_hash").notNull().unique(),
    /** Hash of the learned output only, to skip rewriting unchanged memories. */
    materialHash: text("material_hash").notNull(),
    /** The date an insight describes; older knowledge is never written after newer (see `isNewKnowledge`). */
    asOf: date("as_of"),
    text: text("text").notNull(),
    /** queued → sending → sent → stored, or failed after BUDGET.maxAttempts. */
    status: text("status").notNull().default("queued"),
    jobId: text("job_id"),
    blobId: text("blob_id"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    writtenAt: timestamp("written_at", { withTimezone: true }),
  },
  (t) => [
    index("memory_outbox_pending_idx").on(t.status, t.id).where(sql`${t.status} <> 'stored'`),
    uniqueIndex("memory_outbox_chain_idx").on(t.namespace, t.kind, t.seq),
    index("memory_outbox_subject_idx").on(t.namespace, t.kind, t.subject, t.seq),
    index("memory_outbox_sent_idx").on(t.sentAt),
  ],
);
