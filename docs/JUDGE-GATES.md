# Judge gates: what each production brick must prove

A brick is done only when every row in its gate passes, with evidence recorded here (command output, blob ID, tx digest or screenshot). No brick starts until the previous gate is green. Criteria and hard gates come from `docs/JUDGING_CALIBRATION.md` §0.

## Hard gates (submission is void without these)

| Gate | How we prove it | Brick | Status |
|---|---|---|---|
| Walrus Memory writes on **Mainnet** | Blob IDs from `rememberAndWait` / outbox rows with `blob_id` | 1 | **pass**: app pipeline wrote 2 verified blobs (see Brick 1) |
| **≥ 10 memories** on Mainnet | `listNamespaces()` `memory_count` per namespace, in README | 2 | **pass**: 65 in `ss_g_fd36f984879028d5` |
| Tatum RPC for on-chain data | `/status` live calls + settlement confirmation through Tatum GraphQL | 4, 5 | **pass**: `/status`, wallet balances, and two settlements built, executed and confirmed through Tatum |
| Working demo | Public URL, `/demo` usable without sign-in | 6 | **pass**: [usepaddock.online](https://usepaddock.online) (`/demo`, `/status`, `/app` all 200 over HTTPS) |
| Public repo | GitHub URL | 6 | **pass**: [github.com/0xGp/Paddock](https://github.com/0xGp/Paddock) |
| 2–3 min video | Uploaded link | 7 | **pass**: [youtu.be/kbsOv2sbv6k](https://youtu.be/kbsOv2sbv6k) (2:59, all data from Mainnet) |
| Blog post (what it does, Tatum + Walrus, **how it learned over time**) | Published URL | 7 | written ([`BLOG.md`](BLOG.md)); LinkedIn URL pending |

## Scored criteria → bricks

| Criterion (weight) | What judges look for | Bricks |
|---|---|---|
| Walrus + Tatum integration (30%) | Memory **read back** and changing behaviour; Mainnet proof; Tatum doing real on-chain work | 1, 2, 3, 4, 5 |
| Technical quality (30%) | Clean typed code, tests, CI green, error handling around relayer/Tatum, no client secrets | every brick |
| Creativity (20%) | "Can prove every suggestion": Why? receipts, verified restore, Lagos money | 3 |
| Presentation (20%) | `/demo` works logged-out, "Verify it yourself" README, video, blog | 6, 7 |

## Brick 1: memory layer (write path + read path)

Pass when all of these are true:
- [x] Every memory is a `SPLITSENSE v1` envelope with canonical JSON, `seq` and `prev` per (namespace, kind), and `hash = sha256(payload without hash)` (ADR-0006). Unit-tested, including tamper rejection.
- [x] Namespaces are opaque: `ss_g_<16 hex>` from `sha256(groupId + NAMESPACE_SALT)`; no names in plaintext metadata (ADR-0003).
- [x] Writes go through the Postgres outbox (unique content hash, so duplicates are skipped), drained in batches of ≤ 5, with job IDs and blob IDs recorded (ADR-0007).
- [x] `loadLearnedState(ns)` recalls with ≤ 4 calls, validates every hit, ignores tampered or foreign text, and keeps the latest `seq` per (kind, subject). Tested with `MemWalMock`.
- [x] `ledgerHash` and `learnedHash` are pure and tested (ADR-0006).
- [x] **Live Mainnet round trip:** enqueue → drain → blob IDs stored → `loadLearnedState` returns the same payload hashes. Evidence below.

Evidence (Oct 28, 15:51 UTC, `pnpm memory:roundtrip`, full record in [`evidence/brick1-roundtrip.json`](evidence/brick1-roundtrip.json)):
- Tests: engine 26/26 (`hash.test.ts` adds canonical JSON, SHA-256 vector, order independence, one-kobo tamper); memory 12/12 (`memory.test.ts`: envelope round trip, tamper, header mismatch, foreign text, wrong namespace, chain `seq`/`prev`, checkpoints end on `ledgerHash`, latest-`seq` reducer, `MemWalMock` load in ≤ 4 recalls, timeout degrades instead of throwing). Both packages type-check.
- Mainnet namespace `ss_g_37a6c1efd43850de` (relayer `memory_count` = 2):
  - `group_profile` seq 1 → blob `RzEvZDZgMP8HlIigGXlwrLPRxN83zB_2wVYzwoXsjtw`
  - `pattern_snapshot turn.fuel` seq 1 → blob `vx1FlJDSj76flwajl7SZX9Mje8rZnLxe-43If7yI2NU`
- Re-running `enqueue` with unchanged drafts queued 0 (dedupe by material hash). One `rememberBulk` call; about 40 s from send to Walrus blob.
- Recall returned `turn.fuel` with envelope hash `696cf87d…16ca`, equal to the outbox row; 0 rejected, not degraded. Recalled text: "Tolu has covered diesel 9 of 12 times. Next diesel: Godspower?"

**Brick 1: PASS.**

## Brick 2: Mainnet seeding (≥ 30 memories for Flat 3B)
- [x] `pnpm seed:mainnet` writes the Flat 3B history in timed phases (group profile, checkpoints, pattern snapshots, habits), paced under 30 points/min.
- [x] `listNamespaces()` shows ≥ 30 memories; README lists namespace, count and 5 blob IDs.

Evidence (Oct 28, 16:00–16:30 UTC, full record in [`evidence/brick2-seed.json`](evidence/brick2-seed.json)):
- Namespace `ss_g_fd36f984879028d5`, relayer `memory_count` = **62**: 41 distinct memories (1 profile, 4 checkpoints, 36 insights across Sep 1 / Sep 15 / Oct 1 / Oct 15 / Nov 1) + 21 replayed copies (flagged `replayOfSeq`).
- Paced at 5 remembers/min by the outbox budget; zero failures. A DNS blip mid-run is now retried instead of crashing.
- **Incident, fixed:** resuming after the blip re-queued older phases, because dedupe only compared with the latest material. Fix: `isNewKnowledge` never writes knowledge with an `asOf` not newer than the latest for that subject (new `as_of` column, migration 0002), and the reader picks newest `asOf` then `seq` and collapses twins in the timeline. Both are unit-tested (17/17), including a replay of this exact case. The re-run after the fix queued 0.
- Live recall from Mainnet after seeding: 6 patterns + 4 habits, timeline 36, 0 rejected, every subject at its newest `asOf` despite the replays. **Recall took 12.9 s**, so brick 3 must not recall on the request path (see note there).
- README "Verify it yourself" lists namespace, count and 6 blob IDs.

**Brick 2: PASS.**

## Brick 3: memory visibly drives `/demo`

Constraint from brick 2: a full recall from Mainnet takes about 13 s, far over ADR-0005's 1.5 s budget. `/demo` must render from a cached learned state (refreshed in the background from Walrus, stamped with when and how long) and never block on the relayer.

- [x] `/demo` reads its learned layer from Walrus (with cache + "using cached memory" fallback), showing "recalled from Walrus · N memories · T ms".
- [x] Every learned row links to its memory (kind, created_at, blob_id).
- [x] Memory-off toggle shows the generic app; memory-on brings the learned app back.
- [x] Memory timeline shows what was learned over time, with diffs.
- [x] Restore-from-Walrus shows "Ledger verified up to entry N".

How it works: a background refresh (`refreshSnapshot`, 3 sequential relevance recalls) stores the raw texts recalled from Walrus in `memory_snapshots` (migration 0003). `/demo` is a static page (revalidate 5 min, tag `memory`) whose "Whose turn", "Coming up" and "Settle speed" render **from those envelopes**, not from the engine; every envelope is re-verified (`open` → hash, header, namespace) on each render. Refresh triggers: first visit per browser session (`POST /api/memory/refresh`, throttled to once per 10 min in Postgres), the daily cron on the server (`/api/cron/memory`, `CRON_SECRET`), or `pnpm memory:refresh`. Balances and transfers stay ledger math.

Evidence (Oct 28, 17:42–17:50 WAT, local production build; screenshots in `docs/screens/`):
- Recall finding: `sort: "recent"` makes the relayer ignore the query (a "checkpoint" query returned 0 checkpoints); 4 parallel limit-100 recalls hit the relayer's 13 s SEAL-decrypt timeout (504). Fix: content-shaped relevance queries per kind, sequential, per-kind limits. Result: **63/63 distinct memories, 0 rejected, 14.7 s**.
- Memory card: "Recalled from Walrus · 63 memories · 14,740 ms", "63 memories stored for this flat. Every one re-checked against its hash."
- **Ledger verified up to entry 37**: rebuilt from 4 Walrus checkpoints, each cumulative hash matched against the restored entries and the local ledger. Unit-tested: missing checkpoint, local edit in entries 11–20, un-checkpointed new entry (`restore-timeline.test.ts`).
- Learned row → memory: Diesel "Godspower next" opens to "Remembered on Walrus as pattern #14, learned as of 1 Nov, saved 28 Oct, 17:07. `_x__n1…OiDY`" → Walruscan (HTTP 200). Same blob as the README's Nov 1 diesel memory, so the replayed copies are correctly ignored.
- Toggle (checked in browser): memory off → Memory card "Off", the three learned sections show plain-splitter placeholders, timeline hidden, settle-up and balances unchanged; memory on restores all of it.
- Timeline "How it learned": 35 entries over 1 Sep → 1 Nov with before→after chips (e.g. Next: Ada → Emeka; Due 18 Oct → 1 Nov; Score 31 → 35) and one **Stopped** entry: the groceries rotation, retired on Nov 1 by a new `retired` memory (Mainnet write #63, so Walrus records forgetting as well as learning).
- Fallback, exercised for real: a local DNS outage made the in-app refresh fail; the page then showed "Using cached memory: Walrus didn't answer at 28 Oct, 17:44" while still rendering the re-verified cached memories (`demo-desktop-cached.png`). After DNS recovered, the cron route's refresh inside Next recalled 63 in 15.6 s and the notice cleared.
- Cron route: 401 without `CRON_SECRET`, 200 with it. Tests: engine 26/26, memory 23/23; type checks and ESLint clean; build green.

**Brick 3: PASS.**

## Brick 4: `/status` (Tatum)
- [x] Live Tatum GraphQL calls (chain id, checkpoint, a known tx's balance changes, USDC balance) with latency, cached to respect 3 req/s.

How it works: `packages/chain` is the only Tatum client (ADR-0004). `createTatum` runs every request through one queue spaced at least 350 ms apart (free plan: `x-ttm-plan: free;ratelimit=3`), with an 8 s timeout, up to 2 retries with backoff and jitter on 429, 5xx, network errors and timeouts (honouring `Retry-After`), and returns `{ ok, value | error, ms, attempts, plan }` without ever throwing. Typed reads: `getChainHead`, `getTransaction` (balance changes as `bigint`), `getBalance`. `/status` is one `"use cache"` function (revalidate 30 s, tag `status`) that runs the three Tatum reads plus the Walrus relayer `health()` and `listNamespaces()`, and shows each with its query, result, latency and retry count. The key never reaches the browser.

Evidence (Oct 28, 18:00–18:05 WAT, local production build; full record in [`evidence/brick4-status.json`](evidence/brick4-status.json); screenshots `docs/screens/status-desktop.png`, `status-mobile.png`):
- Chain: `chainIdentifier` `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S` (asserted equal to Sui Mainnet), checkpoint 339,122,405 sealed about 1 s before the check, 585 ms.
- Known transaction `9BP3cyBReBTmWxDWzDP7TuTNyzsL9VMV7he9rP4mwAYx` (a public sponsored USDC transfer, checkpoint 339,121,121): `0x1b88…47c8` −0.000011 USDC, `0x290c…0b6c` +0.000011 USDC, gas sponsor `0x7c8e…bdbf` −0.0001 SUI, 224 ms. `STATUS_KNOWN_DIGEST` switches it to our own settlement in brick 5.
- USDC balance of the recipient `0x290c…0b6c`: 0.018915 USDC, 414 ms.
- Walrus on the same page: relayer `ok`, writes ready, version 0.1.0; demo namespace holds 63 memories.
- Rate limit: after the 30 s window, 2 bursts of 40 parallel `GET /status` 5 s apart each saw a single `checkedAt` (18:02:41, then 18:03:22). 80 requests caused one re-check, i.e. 3 Tatum calls.
- Tests: chain 11/11 unit (fake fetch: `x-api-key` header, spacing of concurrent calls ≥ interval, 429 retried, GraphQL errors not retried, 5xx retry budget, timeout, `bigint` balance changes, unknown digest → `not_found`, missing coin → 0, coin formatting) and 2/2 live against Mainnet (`pnpm test:live`, opt-in so unit runs stay offline). Type checks and ESLint clean; build green (`/status` static, revalidate 30 s).

**Brick 4: PASS.**

## Brick 5: wallet connect + one real USDC settlement
- [ ] Sui wallet connect (ADR-0012), 0.01 USDC transfer executed and confirmed through Tatum GraphQL, digest shown with a Suiscan link, `settlement_receipt` memory written.

Groundwork (Oct 28):
- `packages/chain` `confirmTransfer(digest, {from, to, amount, coinType})`: reads the tx through Tatum, waits up to 15 s for a fresh digest to be indexed, and requires `SUCCESS` plus exactly `-amount` for the payer and `+amount` for the payee in that coin (gas is SUI, so it never blurs the USDC check). 10 unit tests plus a live confirmation of the `/status` transfer.
- `POST /api/sui/graphql`: Tatum proxy for browser transaction building. Same rate limiter as `/status`, 64 KB cap, cross-site requests refused (403), GraphQL errors passed through, the key never in responses.
- Demo wallets from `pnpm sui:keys` (keys only in `.env.local`): payer `0xbc2b335934bb904f0cdce60564844bae509ac81b581fa8330298762d56edaa0a`, payee `0xac250d52d9dc6456d0c444f1b0a2e20347127f8ad6a18a7a8dbcb8904e4d5bf3`.
- Funding: 0.000544 ETH bridged from Ethereum with Mayan (Circle fast transfer), tx [`0xda8276b3…d27c`](https://etherscan.io/tx/0xda8276b398dd80340fbcbef6fadf28471c92fffd86e9858d852597ec37fed27c). It arrived about 1 minute later as **1.201947 native USDC + 0.05 SUI** on the payer, read back through Tatum. That's enough for the 0.01 test and a ~1 USDC settlement in the video (not the 2 USDC SPEC assumed).

**First real settlement (Oct 28, 18:55 WAT, `pnpm settle:smoke --send`)**: 0.01 USDC Emeka → Godspower, tx [`FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2`](https://suiscan.xyz/mainnet/tx/FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2), checkpoint 339,135,513.
- Built (`0x2::balance::send_funds<USDC>`), simulated and executed **through Tatum GraphQL**. **Gasless:** the SDK set gas price 0, budget 0 and no gas coin; the payer's 0.05 SUI is untouched. This closes ADR-0008's open question: a fresh address funded by a bridge, holding USDC as coins, qualifies.
- Execution took 570 ms. `confirmTransfer` through Tatum then checked exact amounts (payer −10,000, payee +10,000 micro-USDC) in 2.7 s. Balances after, read through Tatum: payer 1.191947 USDC, payee 0.01 USDC.
- Found and fixed on the way: the Sui SDK resolves a transaction with parallel GraphQL calls, which hit Tatum's 3 req/s limit (429). `createTatum().fetch` now gives the SDK the same queue and 429 retries (unit-tested).
- `settlement_receipt` memory (`pnpm settle:receipt <digest>`, written only after a fresh Tatum confirmation): seq 1, blob `2mnwqBb4M-kSmnUU8qhrV9mqi7cRLaO_-fmfxsapY0U`, hash `0bc14ede…00f3`, 1,500 kobo (₦15) at the group rate. Re-running queues 0. Recalled from Walrus with the rest: **64/64 verified, 0 rejected** (22.7 s, now 4 sequential recalls), relayer count 64.
- `/demo` shows "Paid on Sui" rendered from that receipt (Suiscan links for the tx and both addresses, Walruscan for the memory). `/status` now reads this transaction.
- Tests: memory 27/27 (receipt conversion, seal and recall by digest, no double write, full-address check), chain 22/22.

**The app (Oct 28, evening)**: onboarding at `/`, then `/app` (Home), `/app/settle` and `/app/activity`, behind a wallet-standard Connect modal. Screens show real data only: wallet balances read through Tatum, the flat from Postgres, payments confirmed through Tatum, receipts from the outbox and Walrus. Wallets that aren't in a flat get an empty state and a link to `/demo`. Screens: `docs/screens/{onboard,connect-modal,home,home-no-flat,settle,activity}-*.png`.
- Migration `0004_payments`: `wallet_links` (Sui address → flat member) and `payments` (one row per Tatum-confirmed settlement). `pnpm wallets:link <digest…>` links the four demo wallets (Ada and Tolu got receive-only keys) and backfilled `FHS5aw5n…`.
- **Receipts now move balances.** `buildFlatView` applies `ledger.payments` (payer net +, payee net −, 5 new engine tests; golden snapshots unchanged). Emeka owes ₦15,735, not ₦15,750, and Godspower now owes Tolu ₦15, because he received Emeka's ₦15 while already square. `/demo` reads the same payments.
- Settle flow: `POST /api/settle/prepare` builds the gasless transfer through Tatum, capped at what you owe that flatmate. The wallet signs it (`sui:signTransaction`). `POST /api/settle/execute` checks the sender is the linked wallet, verifies the signature, simulates through Tatum and requires the exact USDC movement, executes through Tatum, runs `confirmTransfer`, records the payment and queues the receipt. After the response it drains to Walrus and refreshes memory.
- `pnpm settle:api` drives that API like a wallet. **9/9 rejections pass with nothing sent**: over the debt, under 0.01, wrong payee, unlinked wallet, cross-site, someone else's signature, claimed ≠ signed amount, and signer ≠ claimed wallet.
- Found and fixed: the CSS optimiser dropped unprefixed `backdrop-filter` when the `-webkit-` line followed it, so Chrome showed no frosted blur anywhere, `/demo` included.

**Second real settlement, through the app's settle API (Oct 28, 19:25 WAT, `pnpm settle:api --send SUI_PAYEE_PRIVATE_KEY tolu 10000`)**: 0.01 USDC Godspower → Tolu, tx [`Eu7yRGabs6aHsM7pERoULg3HnfM9zZuYRnUNmaNSiXwc`](https://suiscan.xyz/mainnet/tx/Eu7yRGabs6aHsM7pERoULg3HnfM9zZuYRnUNmaNSiXwc), checkpoint 339,143,353.
- The path is prepare (built through Tatum), sign (the script stands in for the wallet), then execute. Execute checked the sender, signature and simulated amounts, ran the transaction through Tatum in 770 ms, and `confirmTransfer` passed in 2.6 s. The whole round trip took 9.7 s. Gasless: Godspower holds 0 SUI.
- The payment row was recorded, and the `settlement_receipt` (seq 2) was written in the background after the response: blob `AhdHmgZ9mqssiPHcqBoiSgfZNIfP7XmSmHokRU8lJoI`, stored on the first attempt. The memory re-read then hit a local DNS failure on the pooled Neon host; `pnpm memory:refresh` recalled **65/65 verified, 0 rejected** (relayer count 65; ledger 37/37).
- Effect: Godspower is now all square (his 0.01 USDC paid off the ₦15 he owed Tolu). Activity shows both payments with "On Walrus". Screens: `docs/screens/activity-mobile.png`, `settle-square-mobile.png`.

**Third settlement, signed in a browser wallet at `/app/settle` (Oct 28, 21:41 WAT)**: 0.05 USDC in a group created in the app ("beach day", ₦100 per USDC), tx [`9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV`](https://suiscan.xyz/mainnet/tx/9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV), checkpoint 339,178,369, 0 SUI gas. Confirmed through Tatum in 1.4 s. With `MEMORY_USER_GROUPS=on` its receipt went to the group's own namespace `ss_g_890a18bd94e3e136`, blob [`TBoGRTyt…`](https://walruscan.com/mainnet/blob/TBoGRTytpSzQcizzvMydeIY3IB4q1WzvGW3XSlGG87w). `pnpm proof` re-confirms all three payments ([`PROOF.md`](PROOF.md)).

The browser-wallet payment above is the one the video shows (scene 7, re-read through Tatum by `pnpm video:data`).

## Brick 6: ship
- [x] Production deploy: [usepaddock.online](https://usepaddock.online) on a VPS (systemd + nginx + Let's Encrypt, local Postgres, daily memory cron).
- [x] Public GitHub repo: [0xGp/Paddock](https://github.com/0xGp/Paddock).
- [x] README organised by criterion, with `pnpm proof` to verify it yourself.
- [x] CI green on GitHub Actions ([`ci.yml`](../.github/workflows/ci.yml)): typecheck (packages, video, web), lint, 88 unit tests.

## Brick 7: story
- [x] 2–3 min video: [youtu.be/kbsOv2sbv6k](https://youtu.be/kbsOv2sbv6k). A Remotion project in `video/`; every chart reads `video/data/mainnet.json`, built by `pnpm video:data` from Walrus Memory recall (65/65 verified), the Walrus Mainnet aggregator (66/66 blobs) and Tatum (3/3 payments, 0 gas).
- [x] Blog written: [`BLOG.md`](BLOG.md), covering what it does, Tatum + Walrus, and how it learned over time, with charts from Mainnet data.
- [ ] Blog published on LinkedIn, URL in the README and the form's "Additional documentation".
- [ ] X and LinkedIn posts tagging @tatum_io and @WalrusProtocol / the Tatum and Walrus Foundation pages.
- [ ] Form drafted, then submitted by Nov 10 12:00 WAT.
