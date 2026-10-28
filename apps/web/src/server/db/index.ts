import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import * as schema from "./schema";

// Pooled Neon URL (PgBouncer) for app traffic; migrations use DATABASE_URL_UNPOOLED via drizzle.config.ts.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool = globalForDb.pgPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// Lets Vercel Fluid compute close idle clients before a function instance is suspended.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
export { pool, schema };
