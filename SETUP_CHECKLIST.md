# SplitSense: Setup Checklist (do this before coding)

Target: everything done by **Tue Oct 20** so the M0 milestone (first Mainnet memory + first Tatum call) can land on day 1. Put values in `.env.local`, and copy the variable names from `.env.example`. Never commit secrets.

> **Registration:** there isn't a separate sign-up step. The only form is **"Submit Project"** at https://recall-tatum-walrus.vercel.app, and you fill it in once at the end (it's one submission per person, deadline **Nov 10, 17:00 UTC / 18:00 WAT**). The site's timeline says "Registration opens" on Oct 20, and Tatum said on X: "no need to sign up, just build your project and submit it". Do join the Discords now.

## 0. Community (5 min)
- [ ] Join the **Tatum Discord**: https://discord.gg/hR6NG7sNXE (office hours from Oct 20; the Mystery Bounty is revealed here)
- [ ] Join the **Walrus Discord**: https://discord.gg/walrusprotocol (MemWal questions: expiry/renewal, `rememberBulk` cost)
- [ ] Note your Discord handle and LinkedIn URL (both required on the form)

## 1. Tatum API key (10 min)
- [ ] Create a free account at https://dashboard.tatum.io/
- [ ] Create a **Mainnet** API key → `TATUM_API_KEY`
- [ ] Copy your **Tatum ID** from *My Account → My Account Info* → `TATUM_ACCOUNT_ID` (needed for the form, not at runtime)
- [x] Smoke test: `pnpm tatum:smoke` (GraphQL; passed Oct 28). The old JSON-RPC curl returns 404 because Tatum's Sui gateway is GraphQL-only now (ADR-0004).
- [x] Walrus Memory: `pnpm memory:health` (passed Oct 28: relayer ok, delegate key matches `MEMWAL_AGENT_ID`). First Mainnet memory written Oct 28 (blob `kbZuVQp7YD3RJ_SZb-OWw6WwQmPXwWdQQb8M9PsJA0w`).
- [ ] Check your plan's credit quota on the pricing/dashboard page (most methods cost ~2 credits)

## 2. Walrus Memory: MemWal Mainnet account (15–20 min)
- [ ] Have a Sui wallet (for example Slush) with a little **SUI** on Mainnet for the account-creation transaction (exact cost is [OPEN]; about 0.1 SUI is plenty)
- [ ] Open https://memory.walrus.xyz/dashboard, connect the wallet, and create the Memory account/agent
- [ ] Create a **delegate key**. Save the **private key** → `MEMWAL_PRIVATE_KEY` (shown once, so store it in a password manager)
- [ ] Copy the **Public key** under *Delegate keys* → `MEMWAL_AGENT_ID` (= the form's MEMWAL_AGENT_ID)
- [ ] Copy the **Account ID** shown after the first delegate key → `MEMWAL_ACCOUNT_ID` (= the form's "Account ID (SUI)")
- [ ] `MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz` (the managed relayer pays WAL/SUI for storage, so you don't need WAL)
- [ ] Generate `NAMESPACE_SALT` with `openssl rand -hex 32`. **Never change it after the first Mainnet write.**
- [ ] Day-1 test: `memwal.health()`, then one `rememberAndWait` into `ss_app`. Record the blob_id (blog screenshot), and check that `getPublicKeyHex() === MEMWAL_AGENT_ID`

## 3. Enoki app + Google OAuth client (30–45 min)
- [ ] Google Cloud console → https://console.cloud.google.com/apis/credentials → configure the OAuth consent screen (External, app name "SplitSense"). Add test users if it stays in Testing mode.
- [ ] Create an **OAuth 2.0 Client ID (Web application)**:
  - Authorized JavaScript origins: `http://localhost:3000`, your Vercel production URL
  - Authorized redirect URIs: the same origins plus the callback path your Enoki/dapp-kit setup uses (check https://docs.enoki.mystenlabs.com/ts-sdk/register)
  - → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] Enoki portal → https://portal.enoki.mystenlabs.com → create the app → add **Google** as an auth provider with that client ID
- [ ] Create a **public API key** with zkLogin enabled for **Mainnet**, and add the allowed origins (localhost + prod) → `NEXT_PUBLIC_ENOKI_API_KEY`
- [ ] (Optional) private key only if you later add Enoki sponsored transactions → `ENOKI_PRIVATE_API_KEY`
- [ ] Check Enoki's Mainnet pricing and limits for zkLogin ([OPEN] in the design)

## 4. SUI and USDC for the demo (20 min + exchange time)
- [ ] Your own **SUI address** for the form/prize → have it ready (you need a USDC-compatible wallet for the payout)
- [ ] Sign in once with each of the **4 demo Google accounts** (Godspower, Tolu, Ada, Emeka) to get their zkLogin addresses
- [ ] Send a few **USDC (Sui Mainnet)** to the demo debtor accounts (≥ 0.01 USDC per gasless transfer; ~5 USDC total covers rehearsals). Coin type `0xdba3…::usdc::USDC`
- [ ] Keep a small SUI balance in your own wallet as a fallback (Slush) in case gasless eligibility fails

## 5. Infra (20 min)
- [ ] GitHub repo (public at submission). Add `TATUM_API_KEY` as an Actions secret for the `chain-integration` job
- [ ] Neon project → `DATABASE_URL`
- [ ] Vercel project linked to the repo. Set all env vars. Remember that **Hobby cron = once/day**
- [ ] Generate `CRON_SECRET` and `ADMIN_DRAIN_TOKEN` (`openssl rand -hex 32`)

## 6. Drop in this pack
- [ ] Copy `.cursor/`, `RESOURCES.md`, `SETUP_CHECKLIST.md`, `.env.example`, and `docs/` into the repo root
- [ ] Add `.env*.local` to `.gitignore` (keep `.env.example` committed)
- [ ] Open the repo in Cursor and check that the rule is listed under *Settings → Rules* (it's `alwaysApply: true`)

## 7. Form answers to collect as you go (paste on Nov 10)
Email · Discord handle · LinkedIn · Telegram (optional) · how you heard · first Web3 project? · **Tatum ID** · **SUI address** · **Account ID (SUI)** · **MEMWAL_AGENT_ID** · description · demo video URL (2–3 min) · GitHub repo · **Additional documentation = blog URL** · **Social post links** (X: tag @tatum_io + @WalrusProtocol; LinkedIn: Tatum + Walrus Foundation) · experience with Walrus · experience with Tatum AI Builder · one Walrus Memory friction point (keep a running note).

## `.env.example` variable names
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUI_NETWORK`, `DATABASE_URL`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_AGENT_ID`, `MEMWAL_SERVER_URL`, `NAMESPACE_SALT`, `TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, `TATUM_SUI_GRAPHQL_URL`, `TATUM_ACCOUNT_ID`, `NEXT_PUBLIC_ENOKI_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ENOKI_PRIVATE_API_KEY` (optional), `USDC_COIN_TYPE`, `GROUP_RATE_NGN_PER_USDC`, `CRON_SECRET`, `ADMIN_DRAIN_TOKEN`, `DEMO_GROUP_ID`, `RESEND_API_KEY` (optional), `QSTASH_TOKEN` (optional).
