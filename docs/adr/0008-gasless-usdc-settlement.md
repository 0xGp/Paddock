# ADR-0008: Gasless USDC settlement, partial payments and rounding

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
Debts are kept in NGN (kobo) and settled in USDC (micro-USDC, 6 dp) at a group rate (demo: ₦1,500 = 1 USDC). The seeded debts are large: Emeka owes Godspower ₦40,000, which is 26.67 USDC. The video plans a ~2 USDC payment, so **partial settlement** has to exist, but SPEC never defines it or the rounding.

## Decision
- **Conversion:** `microUsdc = floor(kobo × 1_000_000 / (rateNgnPerUsdc × 100))`. Rounding is always **down**, in the payer's favour by under 1 micro-USDC, and the UI shows the group rate next to every amount.
- **Minimum:** 0.01 USDC (10,000 micro), which is the gasless minimum. The UI blocks smaller amounts.
- **Partial settlement:** a payment of P kobo against a transfer from debtor A to creditor B closes A→B debt edges **oldest first**. The edge it lands in mid-way is split into a closed part and a remaining open part. All of this is deterministic and recorded in the `settlement_receipt` memory as `edgesClosed[]` and `edgePartial`.
- **Build:** `0x2::balance::send_funds<USDC>` with `tx.balance({ type: USDC, balance })`, `setSender(zkLoginAddress)`, and `tx.build({ client })` where `client` is a `SuiGraphQLClient` pointed at our `/api/sui/graphql` proxy, so the SDK can detect gasless eligibility.
- **Confirm:** server-side with Tatum GraphQL `transaction(digest)` (ADR-0004) before closing edges.

## Consequences
- Open, to test first: (1) whether gasless `send_funds` needs USDC in the sender's **address balance** rather than as `Coin` objects, and whether a fresh zkLogin address funded from an exchange qualifies; (2) whether the Enoki wallet lets us execute through our GraphQL client or insists on its own. If either fails, the fallback is a normal sponsored or self-paid transfer from a Slush wallet, stated honestly in the video.
- **Resolved Oct 28:** (1) yes. A fresh address funded by a bridge, holding USDC as `Coin` objects, built a gasless `send_funds` (gas price 0, budget 0, no gas coin) through Tatum GraphQL, tx `FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2`. (2) is moot under ADR-0012 (wallet, not Enoki).
- Keep a `settle:smoke` script that moves 0.01 USDC between two demo accounts, and run it as soon as Enoki keys exist. **Enoki and Google keys are still empty (checked Oct 28).**
