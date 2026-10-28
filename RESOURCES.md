# SplitSense: Resources

Every doc and SDK link from `docs/SPEC.md` and the hackathon rules, grouped by area. All links returned HTTP 200 on Mon Oct 19, 2026, and the npm versions were checked the same day.

## 1. The hackathon (Tatum x Walrus "Total Recall")
| What | Link |
|---|---|
| Event page (Tatum; it iframes the event site) | https://tatum.io/hackathon/total-recall (short link https://tatum.io/total-recall) |
| **Event site + the only form ("Submit Project")** | https://recall-tatum-walrus.vercel.app |
| Official event rules | https://thewalrussessions.wal.app/tatum-total-recall/index.html |
| Walrus Sessions (all Walrus hackathons) | https://thewalrussessions.wal.app/index.html |
| Tatum hackathons list | https://tatum.io/hackathons |
| **Tatum Discord** (the invite linked from the event site; office hours, Mystery Bounty reveal) | https://discord.gg/hR6NG7sNXE |
| Walrus Discord | https://discord.gg/walrusprotocol |
| Tatum on X / LinkedIn | https://x.com/tatum_io · https://www.linkedin.com/company/tatumio |
| Walrus on X / LinkedIn (tag **@WalrusProtocol** on X; "Walrus Foundation" is the LinkedIn page) | https://x.com/WalrusProtocol · https://www.linkedin.com/company/walrus-foundation |
| Tatum's "no need to sign up" reply (Oct 7, 2026) | https://x.com/tatum_io/status/2107744756587458938 |
| Terms | https://tatum.io/terms-of-use · https://docs.wal.app/docs/legal/walrus_general_tos · https://docs.wal.app/docs/legal/privacy |

Key dates: build window Oct 20 – Nov 10 · **submissions close Nov 10, 17:00 UTC (18:00 WAT)** · judging Nov 11–16 · winners Nov 17.

## 2. Walrus Memory / MemWal
| What | Link |
|---|---|
| Memory dashboard (Mainnet account, delegate keys, MEMWAL_AGENT_ID, Account ID) | https://memory.walrus.xyz/dashboard |
| Walrus Memory docs home | https://docs.wal.app/walrus-memory |
| Quick start | https://docs.wal.app/walrus-memory/getting-started/quick-start |
| SDK quick start | https://docs.wal.app/walrus-memory/sdk/quick-start |
| SDK API reference (`remember`, `rememberBulk`, `recall`, `listMemories`, `restore`) | https://docs.wal.app/walrus-memory/sdk/api-reference |
| Headless setup (server-side delegate key) | https://docs.wal.app/walrus-memory/sdk/headless-setup |
| Configuration | https://docs.wal.app/walrus-memory/reference/configuration |
| Environment variables | https://docs.wal.app/walrus-memory/reference/environment-variables |
| Managed (public) relayer | https://docs.wal.app/walrus-memory/relayer/public-relayer |
| Relayer overview (rate limits, quota, points) | https://docs.wal.app/walrus-memory/relayer/overview |
| Self-hosting the relayer | https://docs.wal.app/walrus-memory/relayer/self-hosting |
| Manage your memory (epochs, renew, restore) | https://docs.wal.app/walrus-memory/guides/manage-your-memory |
| Funding storage (WAL + SUI) | https://docs.wal.app/walrus-memory/fundamentals/architecture/funding-storage |
| Walrus storage costs | https://docs.wal.app/docs/system-overview/storage-costs |
| Troubleshooting (auth model) | https://docs.wal.app/walrus-memory/troubleshooting/overview |
| MemWal GitHub | https://github.com/MystenLabs/MemWal |
| Issue #315 (agent_id = delegate pubkey; public metadata) | https://github.com/MystenLabs/MemWal/issues/315 |
| Walrus Memory for Claude Code / Codex (linked from the event site) | https://blog.walrus.xyz/how-to-add-portable-memory-to-claude-code-and-codex-with-walrus-memory/ |
| Walrus HTTP API (aggregator links for blob_ids) | https://docs.wal.app/docs/usage/web-api |
| Walruscan explorer | https://walruscan.com |
| Mainnet relayer endpoint | `https://relayer.memory.walrus.xyz` |

## 3. Tatum
| What | Link |
|---|---|
| Dashboard (API key; Tatum ID under My Account → My Account Info) | https://dashboard.tatum.io/ |
| Docs home / getting started / API reference | https://docs.tatum.io/ · https://docs.tatum.io/docs/getting-started · https://docs.tatum.io/reference |
| Sui RPC reference | https://docs.tatum.io/reference/rpc-sui |
| Sui chain page | https://tatum.io/chain/sui |
| Sui gRPC guide (native gRPC; **not gRPC-web**) | https://docs.tatum.io/reference/sui-grpc |
| Sui JSON-RPC → gRPC migration guide | https://docs.tatum.io/docs/sui-migration-guide-from-json-rpc-to-grpc |
| Gateway method discovery | https://sui-mainnet.gateway.tatum.io/_methods · https://sui-mainnet.gateway.tatum.io/llms.txt |
| Notifications supported chains (Sui not listed) | https://docs.tatum.io/reference/notifications-supported-chains |
| Data API tx history (EVM only) | https://docs.tatum.io/reference/gettransactionhistoryv4 |
| Pricing / credits | https://tatum.io/pricing |
| AI Builder (+ manifest, terms) | https://ai.tatum.io/ · https://ai.tatum.io/.well-known/tatum-agent.json · https://tatum.io/terms-of-use-ai-builder |
| Endpoints | JSON-RPC `https://sui-mainnet.gateway.tatum.io` · GraphQL `https://sui-mainnet.gateway.tatum.io/graphql` · gRPC (native only) `sui-mainnet-grpc.gateway.tatum.io` · header `x-api-key` |

## 4. Sui, USDC, Enoki
| What | Link |
|---|---|
| Sui TS SDK: coins & balances / gasless | https://sdk.mystenlabs.com/sui/transactions/coins-and-balances |
| Sui docs: gasless stablecoin transfers | https://docs.sui.io/develop/transaction-payment/gasless-stablecoin-transfers |
| Sui SDK 2.0 migration | https://sdk.mystenlabs.com/sui/migrations/sui-2.0 |
| dApp Kit | https://sdk.mystenlabs.com/dapp-kit |
| Enoki docs home | https://docs.enoki.mystenlabs.com |
| Enoki: register wallets (Google zkLogin) | https://docs.enoki.mystenlabs.com/ts-sdk/register |
| Enoki: sponsored transactions | https://docs.enoki.mystenlabs.com/ts-sdk/sponsored-transactions |
| Enoki portal (create app, API keys) | https://portal.enoki.mystenlabs.com |
| Google Cloud OAuth credentials | https://console.cloud.google.com/apis/credentials |
| Circle: USDC on Sui quickstart | https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui |
| Circle: USDC contract addresses | https://developers.circle.com/stablecoins/usdc-contract-addresses |
| Suiscan explorer | https://suiscan.xyz/mainnet/home |
| USDC coin type (Mainnet) | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` |

## 5. Infra used by the design
| What | Link |
|---|---|
| Vercel cron limits (Hobby = once/day) | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Next.js `after()` | https://nextjs.org/docs/app/api-reference/functions/after |
| Neon | https://neon.tech/docs |
| Drizzle ORM | https://orm.drizzle.team/docs/overview |

## 6. npm packages (versions as of Oct 19, 2026)
| Package | Version | Where |
|---|---|---|
| `@mysten-incubation/memwal` | 0.1.8 | packages/memory (server-only) |
| `@mysten/sui` | 2.36.0 | packages/chain, apps/web |
| `@mysten/enoki` | 1.3.0 | apps/web |
| `@mysten/dapp-kit-react` | 2.1.40 | apps/web |
| `next` / `react` | 16.4.2 / 19.3.1 | apps/web |
| `tailwindcss` | 4.3.3 | apps/web |
| `@tanstack/react-query` | 5.104.4 | apps/web (dapp-kit peer) |
| `zod` | 4.6.7 | everywhere |
| `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 | apps/web (db) |
| `@neondatabase/serverless` | 1.2.0 | apps/web (db) |
| `canonicalize` | 5.1.0 | packages/engine, packages/memory (RFC 8785 canonical JSON for hashes) |
| `vitest` / `fast-check` | 5.0.5 / 4.10.2 | dev |
| `@playwright/test` | 1.64.1 | dev |
| `typescript` | 7.0.2 | dev |
| `resend` | 6.34.1 | optional (email nudges, stretch) |
| `@upstash/qstash` | 2.12.0 | optional (only if minute-level schedules are needed) |

Install commands (from the repo root, pnpm workspaces):
```bash
# workspace tooling
pnpm add -Dw typescript vitest fast-check @playwright/test

# packages/memory
pnpm --filter @splitsense/memory add @mysten-incubation/memwal zod canonicalize

# packages/chain
pnpm --filter @splitsense/chain add @mysten/sui zod

# packages/engine (keep it pure: only canonical JSON + zod for input schemas)
pnpm --filter @splitsense/engine add canonicalize zod

# apps/web
pnpm --filter web add next react react-dom @mysten/sui @mysten/dapp-kit-react @mysten/enoki @tanstack/react-query zod drizzle-orm @neondatabase/serverless server-only
pnpm --filter web add -D drizzle-kit tailwindcss

# optional
pnpm --filter web add resend @upstash/qstash
```
Pin `@mysten-incubation/memwal` exactly (`0.1.8`) because it's an incubation package at 0.x and its API may change.
