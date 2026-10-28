# Architecture Decision Records

One file per decision, numbered, never edited after acceptance except to mark it superseded. Format: Status · Date · Context · Decision · Consequences.

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-decisions.md) | Record decisions as ADRs; `docs/SPEC.md` is the build spec, root `DESIGN.md` is the visual system | Accepted |
| [0002](0002-deterministic-engine-no-llm.md) | Deterministic rules engine, no LLM in any decision | Accepted |
| [0003](0003-hashed-memory-namespaces.md) | Salted, hashed Walrus Memory namespaces; no PII in memory text | Accepted |
| [0004](0004-tatum-graphql-only.md) | Tatum Sui access is GraphQL only (no JSON-RPC, no gRPC-web) | Accepted |
| [0005](0005-ledger-in-postgres-learned-layer-in-walrus.md) | Ledger in Postgres; learned layer read from Walrus Memory | Accepted |
| [0006](0006-split-inputs-hash.md) | Split `inputsHash` into `ledgerHash` + `learnedHash`; exclude `now` | Accepted |
| [0007](0007-paced-memory-outbox.md) | Paced outbox with small batches; `after()` drains; no minute crons | Accepted |
| [0008](0008-gasless-usdc-settlement.md) | Gasless USDC settlement via Enoki zkLogin, partial-settlement and rounding rules | Accepted |
| [0009](0009-judge-mode-from-fixture.md) | `/demo` judge mode runs from the committed fixture, not the live DB | Accepted |
| [0010](0010-scope-cut-2026-10-28.md) | Scope cut on Oct 28: lean MVP | Accepted |
| [0012](0012-wallet-is-identity.md) | The connected Sui wallet is the identity; no Google/Enoki | Accepted |
| [0011](0011-neon-postgres-driver.md) | Neon Postgres through `pg` + `attachDatabasePool`; migrations on the direct URL | Accepted |
