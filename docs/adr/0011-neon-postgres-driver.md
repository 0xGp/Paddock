# ADR-0011: Neon Postgres through `pg` with Vercel pool attachment

- **Status:** Accepted (replaces `@neondatabase/serverless` in SPEC §5 and RESOURCES)
- **Date:** 2026-10-28

## Context
The app runs as Next.js on Vercel (Fluid compute). The Neon agent skill (`neon-postgres`) recommends `node-postgres` with `attachDatabasePool` from `@vercel/functions` on Vercel, and the `@neondatabase/serverless` driver for edge or one-shot serverless runtimes. It also says app traffic uses the pooled URL and migrations use the direct URL.

## Decision
- App queries: `drizzle-orm/node-postgres` over a `pg.Pool` (max 5) on `DATABASE_URL` (the `-pooler` PgBouncer host), registered with `attachDatabasePool(pool)`. Lives in `apps/web/src/server/db/index.ts` and is `server-only`.
- Migrations: `drizzle-kit` on `DATABASE_URL_UNPOOLED` (`apps/web/drizzle.config.ts`), committed under `apps/web/drizzle/`.
- Env comes from `neon deploy` / `neon env pull` into the root `.env.local`. `apps/web/.env.local` is a symlink to it, so Next.js and drizzle-kit read the same file.
- Neon project `wispy-shadow-44074566`, branch `production` (linked in `.neon`).

## Consequences
- No session state (`SET`, `LISTEN`, prepared statements across transactions) over the pooled URL.
- Neon scales to zero after 5 idle minutes, so the first query pays a cold start (~1–3 s observed from Lagos to us-east-2). `/demo` must not depend on the DB (ADR-0009).
