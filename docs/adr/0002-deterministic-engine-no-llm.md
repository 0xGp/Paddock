# ADR-0002: Deterministic rules engine, no LLM in any decision

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
SplitSense suggests who pays next, which split to use and when to nudge. These touch money between friends, so a suggestion must be explainable ("Why?") and reproducible. The Walrus Memory SDK offers `analyze()` and `withMemWal`, which use an LLM for fact extraction. The relayer also embeds every memory for semantic recall.

## Decision
- `packages/engine` exports pure functions: `runRules(ledger, learned, now, rulesetVersion)`. No I/O, no `Date.now()`, no `Math.random()`, no env, no AI SDK.
- Thresholds are fixed per `rulesetVersion` (`v1` in SPEC §2.3). Changing one bumps the version and the golden fixtures.
- Embeddings and recall `distance` are used only to *find* memory candidates. Our code validates them (zod + hash) and picks deterministically (latest valid `seq` per `(kind, subject)`).
- Money is integer minor units (`bigint`): kobo for NGN, micro-USDC for USDC. Ratios may be floats, but are rounded to a fixed number of decimals before comparison or display.
- Tie-breaks: score desc, last activity asc, memberId asc. Medians are lower medians.

## Consequences
- Every insight can show its formula, threshold and evidence expense IDs.
- The worked example in SPEC §2.4 is a unit test (`packages/engine/test/worked-example.test.ts`) and passes.
- We give up "smart" free-text understanding. R0 is a fixed grammar, and unknown words fall through to the description.
