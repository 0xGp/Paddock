# ADR-0009: `/demo` judge mode runs from the committed fixture

- **Status:** Accepted (refines SPEC §6.3)
- **Date:** 2026-10-28

## Context
Judges won't sign in with Google or hold USDC. If `/demo` reads the live Neon DB and live Walrus recall, it can break when the DB sleeps, the relayer rate-limits, or a judge clicks "Restore" ten times.

## Decision
- `/demo` renders the seeded "Flat 3B" group from `fixtures/lagos-flat.csv` plus a committed `fixtures/learned-state.json`, run through the real engine at a pinned `now` (`2026-11-01T09:00:00+01:00`). It never writes, and it doesn't need the DB.
- "Restore from Walrus" on `/demo` does a real recall against the demo namespace, but it is rate-limited to one per IP per minute and cached for 5 minutes. If the relayer is unavailable it shows the last recorded result with a timestamp.
- Settlement on `/demo` shows recorded Mainnet tx digests with Suiscan links.

## Consequences
- The frontend can be built now, in parallel with Neon/Enoki setup, because `/demo` only needs the engine and the fixture.
- The fixture is the single source for golden tests, the demo and the Mainnet seed.
