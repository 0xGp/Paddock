# ADR-0007: Paced memory outbox with small batches

- **Status:** Accepted (amends SPEC §3.4 write path)
- **Date:** 2026-10-28

## Context
Managed relayer limits: 30 points/min per delegate key, 60/min and 500/hour per account; `remember` costs 5 points and `recall` 1. The point cost of `rememberBulk` is undocumented (SPEC §9 Q5). If it's 5 points per item, the SPEC's "`rememberBulk` with up to 20 items" costs 100 points and trips the 30/min key limit in a single call. Vercel Hobby cron runs once a day, and `after()` work is bounded by the function's max duration, so a drain can't sleep for minutes between writes.

## Decision
- Every memory write goes into a Postgres `outbox` row (content hash unique, so duplicates are skipped).
- `after()` on each write drains **one batch of at most 5 items** (≤ 25 points if billed per item), then stops. Leftover rows wait for the next write, the admin drain route, or the daily sweeper.
- A per-key token bucket in Postgres (`memory_budget` row: points used in the current minute and hour) gates every drain and every recall.
- On a 429, back off exponentially with jitter and leave the rows queued. Never retry in a tight loop.
- Mainnet seeding runs from a laptop (`pnpm seed:mainnet`), which may sleep between batches.
- Measure the real `rememberBulk` cost on day 1 with one 2-item call, comparing the points before and after on the dashboard, and record it in this ADR.

## Consequences
- Memory writes lag the UI by seconds to minutes. The UI shows queued, writing and stored states per memory.
- Judges hammering `/demo` can't exhaust the write budget, because `/demo` never writes (ADR-0009).
- Optional: a second delegate key just for reads (recall + restore), so judge traffic can't starve writes. Each key gets its own 30/min.
