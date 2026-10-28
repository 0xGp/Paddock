# ADR-0005: Ledger in Postgres; learned layer read from Walrus Memory

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
Judges for "Best Walrus Memory" want memories that are read back and change behaviour, not a write-only backup. But Walrus recall is semantic, capped at 100 results, rate-limited (30 points/min per delegate key) and has no SLA. Money correctness can't depend on it.

## Decision
- **Postgres (Neon) is the source of truth for money:** groups, members, expenses, debt edges, settlements.
- **Walrus Memory is the source of truth for what the app learned:** aliases, split templates, member habits, pattern snapshots, suggestion feedback. `loadLearnedState(ns)` recalls them at session start and when the add-expense form opens, with at most 4 recalls, a 1.5 s budget and a 5-minute cache per group.
- On recall failure the UI uses the cached learned state and says so ("using cached memory").
- The "Memory off" demo toggle passes an empty learned state to the engine, so the difference between the two modes is entirely what memory provides.

## Consequences
- Every learned UI element can carry a "from memory" chip that links to the memory record.
- Restore works in two halves: replay the ledger from `ledger_checkpoint` memories, then reload the learned layer (see ADR-0006 for verification).
- `DATABASE_URL` is still the placeholder (checked Oct 28). Create the Neon project before any API work.
