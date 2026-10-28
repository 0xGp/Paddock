import { count, eq, sql } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { db, schema } from "@/server/db";
import { env } from "@/env";

/** Read-only check: connectivity, server, applied migrations, table counts. */
export async function GET() {
  const started = performance.now();
  const info = await db.execute<{ now: string; version: string; database: string }>(
    sql`select now()::text as now, version() as version, current_database() as database`,
  );
  const migrations = await db.execute<{ applied: number }>(
    sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
  );
  const [groups] = await db.select({ n: count() }).from(schema.groups);
  const [expenses] = await db.select({ n: count() }).from(schema.expenses);
  const [outbox] = await db.select({ n: count() }).from(schema.memoryOutbox);

  return Response.json({
    ok: true,
    latencyMs: Math.round(performance.now() - started),
    server: info.rows[0],
    migrationsApplied: migrations.rows[0]?.applied ?? 0,
    rows: { groups: groups?.n, expenses: expenses?.n, memoryOutbox: outbox?.n },
  });
}

/**
 * Write → read → rollback through the real schema, so nothing persists.
 * Requires `Authorization: Bearer <ADMIN_DRAIN_TOKEN>`.
 */
export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.ADMIN_DRAIN_TOKEN}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = performance.now();
  let readBack: { group: string; payer: string; amountMinor: string; split: Record<string, number> } | undefined;
  try {
    await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(schema.groups)
        .values({ name: "health-check", rateNgnPerUsdc: 1500 })
        .returning({ id: schema.groups.id });
      const [member] = await tx
        .insert(schema.members)
        .values({ groupId: group!.id, displayName: "Tolu" })
        .returning({ id: schema.members.id });
      await tx.insert(schema.expenses).values({
        groupId: group!.id,
        date: "2026-08-02",
        amountMinor: 2_500_000n,
        payerId: member!.id,
        category: "fuel",
        description: "Generator diesel",
        split: { [member!.id]: 10_000 },
      });

      const [row] = await tx
        .select({
          group: schema.groups.name,
          payer: schema.members.displayName,
          amountMinor: schema.expenses.amountMinor,
          split: schema.expenses.split,
        })
        .from(schema.expenses)
        .innerJoin(schema.groups, eq(schema.expenses.groupId, schema.groups.id))
        .innerJoin(schema.members, eq(schema.expenses.payerId, schema.members.id))
        .where(eq(schema.expenses.groupId, group!.id));
      readBack = row && { ...row, amountMinor: row.amountMinor.toString() };
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }

  const [leftover] = await db
    .select({ n: count() })
    .from(schema.groups)
    .where(eq(schema.groups.name, "health-check"));

  return Response.json({
    ok: readBack?.amountMinor === "2500000" && leftover?.n === 0,
    latencyMs: Math.round(performance.now() - started),
    readBack,
    rolledBack: leftover?.n === 0,
  });
}
