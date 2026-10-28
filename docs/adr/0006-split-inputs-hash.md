# ADR-0006: Split `inputsHash` into `ledgerHash` + `learnedHash`; exclude `now`

- **Status:** Accepted (amends SPEC §2.1, §3.4 read path step 2)
- **Date:** 2026-10-28

## Context
SPEC says `inputsHash = sha256(canonicalJSON(inputs))` and that a restore is "verified identical" when the restored engine's `inputsHash` equals the last `pattern_snapshot.inputsHash`. Review found three ways that check always fails or proves the wrong thing:
1. `now` is an input to `runRules`, so restoring at a different time always produces a different hash.
2. `pattern_snapshot` is only written on *material change*, so the last snapshot describes an older ledger than the current one.
3. `ledger_checkpoint` is written every 10 expenses or 24 h, so up to 9 recent expenses may not be in Walrus yet.

The SPEC also puts `"hash"` inside the payload it hashes, which is circular.

## Decision
- `ledgerHash = sha256(canonicalJSON(sortedExpenses + sortedSettlements))`, computed over the ledger *as of a checkpoint `seq`*. Every `ledger_checkpoint` stores the cumulative `ledgerHash` at its `seq`.
- `learnedHash = sha256(canonicalJSON(learnedState))`.
- `inputsHash = sha256(ledgerHash + learnedHash + rulesetVersion)`. **`now` is excluded.** It is recorded on each insight separately as `evaluatedAt`.
- Restore verification compares the replayed `ledgerHash` with the latest checkpoint's `ledgerHash`. The badge says "Ledger verified up to entry N (checkpoint seq K)". It does not claim the newest unsynced entries are on Walrus.
- Payload hash: `hash = sha256(canonicalJSON(payload without "hash"))`. `prev` is the `hash` of the previous memory of the same `(namespace, kind)`, and `seq` is per `(namespace, kind)`.
- Before the demo, force a checkpoint (`POST /api/admin/checkpoint`) so the badge covers the whole ledger.

## Consequences
- The "verified identical" claim is honest and reproducible.
- `packages/engine` exposes `ledgerHash()` and `learnedHash()` as pure functions with tests.
