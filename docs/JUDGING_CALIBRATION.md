# SplitSense: Judging Calibration

**For:** Godspower Ufot · Tatum x Walrus "Total Recall" · Consumer Finance Apps track (also going for Best Walrus Memory)
**Written:** Mon Oct 19, 2026 (WAT, UTC+1) · **Scored against:** DESIGN.md as of Oct 19 (pre-change), then with the changes in §7
**Sources:** official rules https://thewalrussessions.wal.app/tatum-total-recall/index.html and the event site https://recall-tatum-walrus.vercel.app (tatum.io/hackathon/total-recall loads it in an iframe), both read Oct 19.

> **How to read the scores.** These are my estimates of what a sponsor panel would give the *shipped* project if the design is built as written. I've knocked points off for execution risk, because judges score the repo and the demo, not the plan. A 7 is a solid, competitive entry. An 8 or above needs to be clearly ahead of the field on that criterion. No one outside the panel knows how strict they will be, so treat these as relative guidance, not predictions.

---

## 0. The official criteria (verbatim intent)

| Criterion | Weight | Official wording |
|---|---|---|
| Walrus and Tatum integration | 30% | "Meaningful and creative use of Walrus Memory, as well as building with Tatum RPCs or Data APIs." |
| Technical quality | 30% | "Clean code and successful Tatum Sui RPC integration." |
| Creativity | 20% | "Original ideas and distinctive product direction." |
| Presentation | 20% | "Clear documentation and a working demo." |
| Bonus | — | "Sharing your project on X or LinkedIn. Tagging @Tatum_io and @WalrusFoundation is optional and may earn extra points." |

**Hard gates (fail any of these and the score doesn't matter):** Walrus Memory writing on **Mainnet**; **≥ 10 memories** on Mainnet; Tatum RPC used for on-chain data; a **published blog post** (what it does, how it uses Tatum + Walrus, **how it learned over time**); a working demo; a public repo; a 2–3 minute video; and **one submission per person**.

Things I found on the event site that affect scoring (more detail in §6):
- The Consumer Finance brief literally lists *"Group spending that remembers who owes what"* as its first example idea, and the FAQ says *"Do not copy the brief verbatim. Execution beats novelty."* **That's the biggest creativity risk for SplitSense.**
- The form has an optional **"Social post links (Optional, extra points)"** field, so the bonus is checked through links you paste in.
- The form has **no dedicated blog field**. The blog URL goes in "Additional documentation" and in the description and README.
- **@WalrusFoundation can't be an X handle** (16 characters, and X allows at most 15). Walrus's X account is **@WalrusProtocol**, which is what the event site links to. "Walrus Foundation" is their LinkedIn page (linkedin.com/company/walrus-foundation).

---

## 1. Walrus + Tatum integration (30%)

**What judges will look for**
- Memory that *does something*, not a write-only log: the app reads memories back and behaves differently because of them.
- Mainnet proof: memory count, blob IDs, `MEMWAL_AGENT_ID`, `Account ID (SUI)` all match what's on the form.
- Creative use of memory beyond "chat history", such as structured records, provenance, restore, and privacy awareness.
- Tatum used for real on-chain work (reads, tx build and execute, confirmations), not one decorative `getChainIdentifier` call.

**Current design: 7.5 / 10 → weighted 2.25 / 3.00**
Strengths: 6 memory kinds with a versioned envelope and hash chain; hashed namespaces (shows real understanding of the public-metadata leak, issue #315); a paced outbox that respects relayer limits; restore-from-Walrus with an inputs-hash "verified identical" badge; a memory timeline; a memory-off toggle. Tatum is on the critical path: GraphQL for gasless tx builds, execution, and balances, and JSON-RPC for confirmation (`sui_getTransactionBlock`) and incoming-transfer polling.

**Gaps**
1. **Memory sits off the hot path.** §3.4 says "Postgres is the hot cache… Memory is never on the critical path." A Walrus judge can fairly read that as *Postgres is the app and Walrus is a backup*. Apart from the restore flow, the engine never *recalls* anything during normal use.
2. **The learning loop is one-directional.** Patterns are derived from the ledger and written to memory, but only R10 learns from the *outcomes* of the app's own suggestions. "Deepest learning loop" suggests outcome feedback.
3. **No portability across contexts.** The track text says *"Walrus Memory makes balances, habits, and preferences stick across sessions."* Memory is per group only, so a member's learned aliases and preferences don't follow them into a new group.
4. **Tatum is used in an ordinary way.** It's solid, but every entrant will use Tatum RPC. Nothing reads the memory blobs' own on-chain objects through Tatum yet (blob_id → object ID is still [OPEN]).
5. **Expiry risk:** if relayer-default blobs lapse before Nov 17 judging, the "≥ 10 on Mainnet" gate could fail when judges check.

**Changes, ranked by impact per effort**
| # | Change | Impact | Effort |
|---|---|---|---|
| I-1 | **Memory-first learned layer:** at session start and when the add-expense form opens, *recall* the group's `preference`, `member_habit` and latest `pattern_snapshot` memories and use them (after zod and hash validation) as the source for the learned UI layer. Postgres caches them. Show "🧠 recalled from Walrus · 6 memories · 410 ms". The ledger can stay in Postgres. | High | Medium (1–1.5 days) |
| I-2 | **Outcome learning (R11):** record whether each nudge led to payment within 48h, and whether accepted rotation suggestions were actually followed, then use that to shift nudge timing and suggestion confidence. Written as `outcome` memories. | High (also Best Memory) | Low–Medium (≤ 1 day) |
| I-3 | **"Verify on-chain" through Tatum:** in the memory timeline, resolve a memory's Walrus Blob object and read its `memwal_*` metadata with Tatum `sui_getObject` / GraphQL. If blob_id → object ID can't be resolved, show the `rememberAndWait` owner/tx data plus a Walruscan link instead. | Medium | Low–Medium |
| I-4 | **Portable member profile (opt-in):** a per-member namespace for *non-financial* learned prefs (aliases, split-template pins, nudge opt-outs). A new trip group then starts with "Ada's aliases (12) loaded from her memory". | Medium (also Creativity) | Medium |
| I-5 | **Expiry hygiene:** a `scripts/memory-health.ts` that lists `expires_at`/`end_epoch`. Re-write the canonical memories on Nov 9 and show expiry in the timeline (already partly planned). | Gate protection | Low |

**After changes: 8.5 / 10 → 2.55 / 3.00**

---

## 2. Technical quality (30%)

**What judges will look for:** a readable repo structure, tests that run, CI that's green, typed boundaries, error handling around flaky network services, no secrets in the client, and Tatum Sui RPC calls that *visibly work* in the demo and code.

**Current design: 7.0 / 10 → weighted 2.10 / 3.00**
On paper this is excellent: a pure deterministic engine, golden fixtures, fast-check conservation properties, zod everywhere, a monorepo split, CI, and the Tatum key kept on the server through a GraphQL proxy. I scored it 7 and not 8–9 because of **execution risk**. One person has 3 weeks to build 10 rules, 6 memory kinds, a hash-chain restore, zkLogin, gasless USDC, cron jobs, a PWA, and email. Half-finished features count against technical quality more than missing ones do.

**Gaps**
1. **The schedule infrastructure is broken on the free tier (verified).** Vercel **Hobby** cron runs *at most once per day* with ±59 min precision, and anything more frequent fails at deploy ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). The design's 1-min outbox drain, 15-min settlement poll, and hourly nudges won't deploy on Hobby.
2. **Scope has no explicit cut line.** §8 R-12 mentions cutting, but there's no must-have vs stretch list.
3. **Nothing in CI proves the Tatum integration works.** Judges see it in the video, but there's no integration test or status page they can check themselves.
4. JSON-RPC deprecation (R-6) is handled in the design. Keep the transport wrapper thin and tested.

**Changes, ranked by impact per effort**
| # | Change | Impact | Effort |
|---|---|---|---|
| T-1 | **Fix jobs:** drain the outbox in-request using Next.js `after()` after each write, add a manual/admin "drain now" route, run seeding from a local script (`pnpm seed:mainnet`), and keep a *daily* Vercel cron as a sweeper. Use Upstash QStash (or Vercel Pro) only if minute-level schedules turn out to be essential. Run settlement checks on demand (when the user returns from signing, and when the dashboard loads), not by polling. | High (avoids a broken pipeline) | Low |
| T-2 | **Tiered scope (MVP / Stretch):** freeze the MVP at R1, R2, R3, R5, R6, R7, R10, R11, the memory outbox, restore, settlement, and judge mode. R4, R8, R9 timing polish, PWA, email, and the portable profile are stretch. | High | Very low |
| T-3 | **`packages/chain` integration tests** against Tatum (chain id, checkpoint, a known tx digest's balance changes, a USDC balance). They run in CI with a repo secret, are skipped for forks, and feed a **`/status` page** showing live Tatum calls (method, latency, last result). | Medium–High | Low |
| T-4 | Retries and backoff with jitter on both relayer and Tatum; typed error results; a single `env.ts` validated with zod at boot. | Medium | Low |
| T-5 | ADRs (`docs/adr/`) for "deterministic, no LLM", "hashed namespaces", "GraphQL over gRPC-web". Cheap, and judges read them. | Low–Medium | Very low |

**After changes: 8.0 / 10 → 2.40 / 3.00**

---

## 3. Creativity (20%)

**What judges will look for:** something they haven't already seen ten times in this hackathon, and a product with a point of view.

**Current design: 6.0 / 10 → weighted 1.20 / 2.00**
Honest take: *a Splitwise that remembers* is the **first example in the official Consumer Finance brief**, so several entries will look similar on the surface. SplitSense stands out in its **execution details**: no-LLM explainable rules with "Why?", an inputs hash that proves the restored state is identical, Lagos-specific money life (diesel, NEPA tokens, data bundles, service charge), payday-window nudges, and invisible gasless USDC. Today those differentiators are scattered through the doc and not packaged as *the* story.

**Gaps:** the pitch leads with the generic idea. "Deterministic" and "verifiable" are framed as engineering choices when they could be the product's identity. Entry still feels like a form, even though the pitch says "log it the way you'd text it".

**Changes, ranked by impact per effort**
| # | Change | Impact | Effort |
|---|---|---|---|
| C-1 | **Reposition the story** in the README, video and blog: "*The group-money app that remembers how your flat actually lives, and can prove every suggestion.*" Lead with "explainable, verifiable memory" and Lagos realities, not "split bills". | Medium–High | Very low |
| C-2 | **Quick-entry parser (R0):** a deterministic grammar for "25k diesel tolu paid", "₦4,500 LAWMA — me", "shoprite 38k split ada emeka". It matches the pitch, demos well in 5 seconds, and makes "learned aliases" visible. No LLM. | Medium | Low–Medium |
| C-3 | **Portable member profile** (I-4). This is the "Total Recall" theme in consumer form: *your habits follow you into the next trip group*. | Medium | Medium |
| C-4 | Present the "memory diff" as a product feature, e.g. a weekly "What SplitSense learned this week" card built from the timeline. | Low–Medium | Low |

**After changes: 7.0 / 10 → 1.40 / 2.00**

---

## 4. Presentation (20%)

**What judges will look for:** a demo they can open and *use* in under a minute, a README that explains setup and architecture, a tight 2–3 minute video, and a blog post that covers the three required topics.

**Current design: 7.0 / 10 → weighted 1.40 / 2.00**
The video script, blog outline, and Mermaid diagram are already strong. The gap is **judge access**. A judge won't have a Google account wired to the Enoki app, Mainnet USDC, or the patience to log 70 expenses. If the live URL opens on an empty sign-in wall, the "working demo" box is half-ticked.

**Gaps:** no logged-out path into a populated group; no "verify it yourself" proof section; the blog has no dedicated field on the form (it must go in "Additional documentation"); the submission is planned for 12:00 WAT on Nov 10 with no form dry run.

**Changes, ranked by impact per effort**
| # | Change | Impact | Effort |
|---|---|---|---|
| P-1 | **Judge mode:** a public `/demo` route opens the seeded Flat 3B group read-only, with Why? panels, the memory timeline, the memory-off toggle, and "restore from Walrus" all working. Settlement shows the recorded Mainnet tx digest, and judges can do a live 0.01 USDC transfer only if signed in. | High | Low–Medium |
| P-2 | **"Verify it yourself" section** at the top of the README: memory count from `listMemories`, namespaces, sample blob IDs with Walruscan links, `MEMWAL_AGENT_ID`, settlement tx digests with Suiscan links, and the `/status` page. | High | Very low |
| P-3 | The README follows the judging criteria, with one section per criterion. Include a GIF of the before/after add-expense form at the top. | Medium | Very low |
| P-4 | Publish the blog on Nov 8 and put its URL in the description, README, and "Additional documentation". Draft the form on Nov 9. | Gate protection | Very low |

**After changes: 8.5 / 10 → 1.70 / 2.00**

---

## 5. Bonus: sharing on X / LinkedIn

**What judges will look for:** links in the form's "Social post links" field, and ideally posts that tag the sponsors.

**Current plan:** one X and LinkedIn post on Nov 10. That's fine, but it's the minimum and comes late.

**Gap (factual):** "@WalrusFoundation" doesn't exist on X (it's 16 characters and handles max out at 15). Tagging it on X does nothing. **On X, tag @tatum_io and @WalrusProtocol.** On LinkedIn, tag the **Tatum** and **Walrus Foundation** company pages.

**Changes:** (B-1) Put up a build-in-public thread with 2–3 posts: M0 first Mainnet memory (Oct 20), M3 first gasless USDC settlement (Oct 31), and launch (Nov 8–10) with the blog link. (B-2) Make one LinkedIn post at launch. (B-3) Paste every link into "Social post links". Each post still needs your approval before it goes out. The size of the bonus isn't published, so I'm not adding it to the weighted totals.

---

## 6. Special prizes

### Best Walrus Memory: $500 ("deepest learning loop, memories that visibly change the product")
- **Fit:** strong. The design already has before/after forms, a memory timeline, the memory-off toggle, and restore-with-proof.
- **What's missing:** loop *depth*. Today memory mostly records what the engine derived from the ledger. The Walrus team will be looking for memories that are **read back to drive behaviour** (I-1) and that **learn from outcomes** (R10 plus the new R11), with the change visible (timeline diffs like "nudge window moved from the 25th to the 27th after 3 ignored nudges").
- **Competition:** Walrus has run several memory-focused Sessions (Chatbots That Remember, Prompt Jam, World Cup agent), so experienced memory builders will enter.
- **Estimate:** a credible contender before the changes, and a strong contender after I-1, I-2 and C-4. That's a qualitative call, not a probability.

### Best Tatum AI Builder App: $500 ("best shippable product built *primarily* with ai.tatum.io")
- **Fit: poor. Recommend skipping.** SplitSense is hand-built and test-driven. The rules also say **"You must not make more than one submission per person"**, so a separate AI-Builder companion app *can't* be submitted alongside SplitSense. The previous R-9 plan doesn't work. The only way in would be to build SplitSense itself primarily in AI Builder, which conflicts with the engine-first design.
- **Optional, low-cost:** prompt AI Builder once for a landing-page shell and mention it honestly in the form's "experience with AI Builder" field. Don't spend more than about 1 hour on it and don't expect the prize. **Score: 2/10 fit.**

### Mystery Bounty: $500
- Revealed "closer to the event" on Discord. It can't be scored yet. **Action:** join the Tatum Discord (https://discord.gg/hR6NG7sNXE, the invite the event site uses) and the Walrus Discord (https://discord.gg/walrusprotocol). Keep Sun Nov 1 as a flex/buffer day so a small bounty-specific feature can fit. The modular `packages/*` layout makes small add-ons cheap.

---

## 7. Totals

| Criterion | Weight | Before (score → weighted) | After (score → weighted) |
|---|---|---|---|
| Walrus + Tatum integration | 30% | 7.5 → 2.25 | 8.5 → 2.55 |
| Technical quality | 30% | 7.0 → 2.10 | 8.0 → 2.40 |
| Creativity | 20% | 6.0 → 1.20 | 7.0 → 1.40 |
| Presentation | 20% | 7.0 → 1.40 | 8.5 → 1.70 |
| **Total (out of 10)** | | **6.95** | **8.05** |
| Bonus (social) | n/a | planned, late, wrong X handle | thread + LinkedIn, correct handles |

The biggest drag on the "after" score is still the **creativity ceiling of the brief's own example idea**. Execution and story can only lift that so far.

## 8. Prioritized design adjustments (impact ÷ effort)

1. **T-2 Tiered scope with a hard MVP line.** Near-zero effort, and it protects every criterion. *(DESIGN §6.0, new)*
2. **T-1 Replace minute-level Vercel Cron.** It's verified that this won't deploy on Hobby. Use `after()` drains, on-demand settlement checks, a local seed script, and a daily sweeper. *(DESIGN §4, §5, §8 R-14)*
3. **P-1 + P-2 Judge mode `/demo` and a "Verify it yourself" README.** This is the biggest presentation gain for the effort. *(DESIGN §6.3, new)*
4. **I-1 Memory-first learned layer (recall on the hot path for learned state).** This is the core integration and Best-Memory upgrade. *(DESIGN §3.4, §3.6 new)*
5. **I-2 R11 outcome learning.** This deepens the loop, and the change shows up in the timeline. *(DESIGN §2.3, §3.4)*
6. **T-3 Tatum integration tests and the `/status` page.** *(DESIGN §4, §5)*
7. **C-1 + C-2 Reposition the story and add the quick-entry parser R0.** *(DESIGN §1, §2.3)*
8. **B-1..3 Social posts with the correct handles (@tatum_io, @WalrusProtocol; LinkedIn: Walrus Foundation), plus a build-in-public thread.** *(DESIGN §6)*
9. **Drop the AI-Builder companion plan** (one submission per person). *(DESIGN §8 R-9)*
10. **I-3 / I-4 Verify-on-chain through Tatum and the portable member profile.** These are stretch goals. *(DESIGN §3.6, §4)*

## 9. What changed in DESIGN.md (Oct 19)
See the "Changelog" block at the top of DESIGN.md. In summary:
- Resolved form-field OPENs from the official form's help text: **Tatum ID** = dashboard.tatum.io → My Account → My Account Info. **Account ID (SUI)** = the ID you receive after creating your first delegate key at memory.walrus.xyz/dashboard. **MEMWAL_AGENT_ID** = the *Public key* under Delegate keys.
- Added R0 (quick-entry parser) and R11 (outcome learning), and the memory-first learned layer §3.6.
- Replaced minute-level Vercel Cron with `after()`, on-demand checks, and a daily sweeper. Added risk R-14.
- Added the MVP/Stretch tiers (§6.0), judge mode and Verify-it-yourself (§6.3), and the `/status` page.
- Fixed social tagging (X: @tatum_io + @WalrusProtocol). Noted the blog goes in "Additional documentation" and the posts go in "Social post links".
- Rewrote R-9: AI Builder companion dropped (one submission per person).
- Added registration findings and the Discord links.
