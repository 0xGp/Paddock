# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first responsive web app (confirmed Oct 28). Flatmates use it on phones; hackathon judges open `/demo` on desktop and must still get a complete, well-composed layout.

## Stack
Next.js App Router + TypeScript (strict) + Tailwind CSS + shadcn/ui, pnpm monorepo (`apps/web`, `packages/engine`, `packages/memory`, `packages/chain`). Deployed on Vercel (Hobby). Decided in `docs/SPEC.md` §5; not reopened.

## Users
- **Primary: flatmates in a shared Lagos flat** (the seeded example is "Flat 3B, Admiralty Way, Lekki Phase 1": Godspower, Tolu, Ada, Emeka). They share recurring costs: generator diesel, prepaid power (NEPA/IKEDC tokens), data bundles, service charge, LAWMA waste and groceries. Their job is to log a cost in seconds, the way they'd text it, know who owes whom, and settle without arguments.
- **Secondary: trip and friend groups** with the same job over a shorter horizon.
- **Evaluators: hackathon judges** (Tatum × Walrus "Total Recall"), who open `/demo` without signing in and need to see, within a minute, that the app's suggestions come from memory and can be verified.

## Product Purpose
SplitSense is a shared-spending app that remembers how a group actually lives (who usually pays for what, which bills recur, how fast each person settles, which suggestions they accept or dismiss) and uses that to pre-fill splits, suggest whose turn it is, and keep balances honest. Success: a flat stops arguing about money, and a judge can trace any suggestion back to the numbers and the memory that produced it.

## Positioning
The group-money app that remembers how your flat actually lives, and can prove every suggestion. Three things a neighbouring split-bill app can't truthfully claim together:
1. **Deterministic, explainable suggestions.** No AI model decides anything. Fixed, versioned rules; every suggestion has a "Why?" with formula, threshold and evidence.
2. **Verifiable memory.** What the app learned lives in encrypted Walrus Memory on Sui Mainnet, comes back on a new device, and is checked by hash.
3. **Lagos money realities with quiet crypto.** NGN ledger; settlement in USDC from the member's own Sui wallet (ADR-0012), with no gas or raw addresses in primary copy.

## Operating Context
- People log costs right after paying, often one-handed, on mid-range Android phones and sometimes slow or metered mobile data.
- Money conversations happen in WhatsApp; entries are typed like a chat line ("25k diesel tolu paid").
- Amounts are shown in USDC. The ledger records naira, converted at a group-set rate (demo: ₦1,500 = 1 USDC), always labelled "group rate", never presented as live FX.
- Judges evaluate on desktop through `/demo` (read-only seeded group), `/status` (live Tatum calls) and the memory timeline, alongside a 2–3 minute video.

## Capabilities and Constraints
- MVP (ADR-0010): quick entry (R0), category resolver with learned aliases (R1), recurring bills (R2), usual payer (R3), settle-speed badge (R5), fair split and "whose turn" (R6), balances and minimal transfers (R7), dismissal learning (R10); memory timeline; memory-off toggle; restore from Walrus with a ledger-hash check; wallet connect as identity (ADR-0012, no email or Google login) and one USDC settlement.
- Cut for now: payday-window nudges (R4/R9), anomaly and missed bills (R8), outcome learning (R11), PWA, email.
- Memory writes take seconds to minutes and are rate-limited, so the UI must show queued, writing and stored states and never block on them.
- Every learned element carries a "from memory" marker that links to its memory record.
- Never show seed phrases, gas or raw addresses unless the user opens details.
- Terminology: "flat"/"group", "expense", "settle", "group rate", "from memory", "Why?".

## Brand Commitments
- Name: **Paddock** (codename SplitSense: package names and the `SPLITSENSE v1` memory format keep it).
- Voice (confirmed): plain, warm English with Lagos money words used naturally (diesel, NEPA, data, service charge, LAWMA, Shoprite). No crypto jargon in primary copy ("Pay Emeka 2.00 USDC", not "Send 2 USDC to 0x…").
- Visual direction (user-pinned Oct 28, from fintech app references): **rounded glassmorphism in Sui blue, navy and teal.** Light ground washed with soft teal and blue light; frosted white glass cards (28px corners); a deep navy-to-Sui-blue balance card with white pill buttons; teal "Today" chips; tinted initial avatars; floating navy pill tab bar on phones; Plus Jakarta Sans. Craft bar stays Monzo, Revolut and Linear.
- No logo exists yet.

## Evidence on Hand
- Seeded demo scenario and worked example: `docs/SPEC.md` §2.4 and §7 (verified by `packages/engine/test/worked-example.test.ts`).
- First Mainnet memory (Oct 28): blob `kbZuVQp7YD3RJ_SZb-OWw6WwQmPXwWdQQb8M9PsJA0w`, namespace `ss_app`.
- No real users, testimonials, metrics or press exist. Don't fabricate any.

## Product Principles
1. **Show the receipt.** Any number or suggestion can be opened to show where it came from.
2. **Typing beats forms.** The fastest path is one chat-like line; structured fields are for correction.
3. **Memory must be visible.** If memory changes a behaviour, the user can see that it did and can turn it off.
4. **Money is never ambiguous.** Exact integer amounts, explicit rate, no hidden rounding in anyone's favour beyond what's stated.
5. **Crypto stays backstage.** Settlement feels like a bank transfer; chain details live behind "details".

## Accessibility & Inclusion
WCAG 2.2 AA. Large touch targets for one-handed phone use, readable on low-end screens in bright light, works on slow connections, and all amounts readable by screen readers (USDC announced properly).
