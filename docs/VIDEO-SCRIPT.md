# Paddock: demo video script

**Length:** 2:45–2:55 (the rules ask for 2–3 minutes). **Format:** 1920×1080, 30 fps, burned-in captions.
**Voice:** ElevenLabs, female, calm and unhurried (speed 0.9). **Visuals:** Remotion, mixing captures of the live app ([usepaddock.online/demo](https://usepaddock.online/demo)) with animated line graphs.

## The data rule: everything comes from Mainnet

Every number and every graph point in the video comes from **`video/data/mainnet.json`**, which `pnpm video:data` builds from Mainnet only:

1. **Walrus Memory:** Flat 3B's memories are recalled from the Mainnet relayer (namespace `ss_g_fd36f984879028d5`), and every envelope is re-checked against its hash. Last run: **65 recalled, 65 verified, 0 rejected**.
2. **Walrus Mainnet blobs:** every blob the video points at is downloaded from the public Walrus Mainnet aggregator (`aggregator.walrus-mainnet.walrus.space`). Last run: **66 of 66 available**.
3. **The bills** come from the 4 ledger checkpoints stored on Walrus (entries 10, 20, 30 and 37), not from the app's database. Rebuilt ledger: **37 of 37 entries matched**.
4. **Sui Mainnet, through Tatum:** the 3 payments are re-read through Tatum's Sui Mainnet GraphQL: status, checkpoint, exact USDC balance changes, and the payer's SUI change (gas).
5. **Memory count:** the relayer reports **69 memories in 4 namespaces**.
6. **Money is shown in USDC only.** Bill amounts are converted at the flat's own rate (1,500 per USDC), read from its `group_profile` memory on Walrus (blob `2lcNCvteAEI8s_9bEA6VqR9ljCd5lcXsH2mbGnIXs80`).

Each graph point carries the **Walrus blob ID** it came from. Show it on screen in Geist Mono under the point, e.g. `blob _x__n1nD…`, so judges can find it on [Walruscan](https://walruscan.com/mainnet/home). Run `pnpm video:data` again right before rendering so the file is fresh.

The flat's people and bills are a demo (see the README's "Honest limits"). The memories, blobs and payments are real Mainnet objects. The x-axis dates on the learning graphs are the flat's **learning rounds** (the `asOf` stored in each memory). All the memories were written to Mainnet in one paced run on 28 Oct, so never say "over three months on Mainnet".

## What the judges score, and where the video answers it

| Criterion (weight) | What they want to see | Scenes |
|---|---|---|
| Walrus + Tatum integration (30%) | Memory that is **read back** and **changes the product**; Mainnet proof; Tatum doing real on-chain work | 3, 4, 5, 6, 7 |
| Technical quality (30%) | Clean code, working Tatum Sui integration, tests | 7, 8 |
| Creativity (20%) | A distinct product direction | 1, 2, 4 (suggestions you can prove, Lagos money life) |
| Presentation (20%) | A clear story and a working demo | the whole video, 9 (live URL) |
| Hard gate: blog and "how it learned over time" | A visible learning loop | 5 |
| Hard gate: ≥ 10 memories on Mainnet | The count, on screen | 3, 9 |

## Narration (paste into ElevenLabs, one clip per scene)

Roughly 410 words, about 2:45 of speech at a relaxed pace.

**1. The problem**
> In a shared flat in Lagos, the money never stops. Over eight hundred USDC in bills in three months. Diesel every week. Prepaid power. Data. Someone pays, someone forgets, and the argument starts in the group chat.

**2. Paddock**
> This is Paddock: shared bills that remember. It learns how your flat actually lives, keeps what it learned in Walrus Memory on Sui Mainnet, and settles up in USDC through Tatum, with zero gas.

**3. Memory drives the app**
> This is judge mode. No sign-in. Flat 3B has thirty-seven bills, all checkpointed on Walrus Mainnet. Paddock just recalled sixty-five memories from Walrus and re-checked each one against its hash. Whose turn, Coming up, and Settle speed are all drawn from those memories. Switch memory off, and it's a plain bill splitter. Same balances. No idea Tolu keeps buying the diesel.

**4. Every suggestion can be proved**
> Every suggestion shows its working. Diesel: Godspower, because Tolu paid nine of the last twelve. Tap it, and you get the formula, the numbers, and the exact Walrus blob it came from. No AI model guessing. Fixed, versioned rules anyone can check.

**5. How it learned over time**
> And it learns over time. Each round, Paddock re-runs its rules and writes only what changed. Six things in the first round. Thirty-five by the fifth. Tolu's diesel run went from five of five to nine of twelve, so the next turn moved to Godspower. Emeka got quicker, from ten days to nine. And when the groceries rotation stopped holding, Paddock wrote that down too. Forgetting is a memory.

**6. Verified, private**
> The ledger is checkpointed to Walrus too. Paddock rebuilds it from four checkpoints and matches all thirty-seven entries, hash for hash. Namespaces are hashed and memories are SEAL-encrypted, so no names leak on-chain.

**7. Settling through Tatum**
> Settling up runs through Tatum's Sui Mainnet gateway at every step. Paddock builds a gasless USDC transfer, simulates it, and checks the payer loses, and the payee gains, exactly the agreed amount. The wallet signs. Tatum executes. Tatum confirms the balance change. Only then does the receipt go to Walrus. Three real payments. Zero gas.

**8. Check it yourself**
> You can check it live. The status page calls Tatum in real time: chain, latest checkpoint, a known transaction, a USDC balance. Behind it: strict TypeScript, eighty-eight unit tests, live Tatum tests, and twelve decision records.

**9. Close**
> Sixty-nine memories on Mainnet. Three gasless payments. One flat that remembers. Paddock. Try it at usepaddock dot online. The proof for every number is in the repo.

**Pronunciation:** USDC = the letters "U-S-D-C". Tatum = "TAY-tum". Sui = "swee". Walrus = "WAL-rus". "usepaddock dot online" is spoken as written. If the voice stumbles on "SEAL-encrypted", write it as "seal encrypted".

## Scene by scene

Times are targets. In Remotion each scene's length comes from its voice clip plus about 0.4 s of air. The field names in brackets are keys in `video/data/mainnet.json`.

### 1. The problem (0:00–0:13)
- **On screen (Remotion):** deep navy background with a teal **spend line** drawing left to right from 1 Aug to 28 Oct. It steps up once per bill, 37 steps, ending at **802.67 USDC** (`spend[].cumulativeUsdc`). Each step shows a small chip for its bill in USDC (`spend[].description`, `spend[].usdc`), e.g. "Generator diesel 16.67 USDC", "IKEDC prepaid token 26.67 USDC", "Spectranet data 20 USDC". Chips for Generator diesel, IKEDC prepaid token and Spectranet data stay visible longer, in time with the words. On "the argument starts in the group chat", chat bubbles slide in: "who bought diesel last??", "not me", "I did last week", "…".
- **Source label (bottom left):** "Bills read from 4 ledger checkpoints on Walrus Mainnet · in USDC at the flat's rate from its Walrus group profile".
- **Judge point:** a real, local consumer-finance problem (creativity).

### 2. Paddock (0:13–0:26)
- **On screen:** the chat bubbles collapse into the Paddock logo (the banknote and coin tile), then the wordmark and the tagline "Shared bills that remember." Three labels draw in under it, joined by one line moving left to right: **Learns** (the habits) → **Remembers** (Walrus Memory · Sui Mainnet) → **Settles** (USDC through Tatum · 0 gas).
- **Judge point:** both sponsors named in the first 25 seconds, each with a clear job.

### 3. Memory drives the app (0:26–0:55)
- **On screen (capture of `/demo`):** the full page loads, then zoom to the **Memory** card: "Recalled from Walrus · 65 memories" and "Ledger verified up to entry 37". Highlight rings pulse around **Whose turn**, **Coming up** and **Settle speed** as they're named. On "Switch memory off", click the **Memory on** switch in the top right. The three cards fade out and the balance card ("Still open 10.49 USDC") doesn't move.
- **Overlay:** a badge pinned in the corner: "65 recalled · 65 verified · 0 rejected" (`recall`).
- **Judge point:** memory is **read back** and **changes what the user sees**. This is the core Walrus criterion and the Best Walrus Memory prize.

### 4. Every suggestion can be proved (0:55–1:12)
- **On screen (capture):** open **Diesel: Godspower** ("Tolu paid 9 of the last 12"). The "Why?" panel opens with the facts, the formula and "Remembered on Walrus as pattern #14". Click the Walruscan link and cut to [blob `_x__n1nD3gleY_ZQduTJtcNYmFIhPUg7R0H3A4yOiDY`](https://walruscan.com/mainnet/blob/_x__n1nD3gleY_ZQduTJtcNYmFIhPUg7R0H3A4yOiDY) on Walruscan.
- **Overlay:** a line traces from the "Why?" row to the blob ID on Walruscan, so the link from suggestion to Mainnet object is literal.
- **Judge point:** explainable and verifiable memory, which is Paddock's distinct direction (creativity).

### 5. How it learned over time (1:12–1:45): the line graphs
All three graphs share one x-axis: learning rounds **1 Sep, 15 Sep, 1 Oct, 15 Oct, 1 Nov** (`asOf`), labelled "Learning round (as of)". Every dot shows its blob ID underneath.

- **Graph A, the learning curve** (`learning[]`): "Things Paddock noticed or revised", cumulative. **6 → 12 → 18 → 28 → 35.** The line draws itself point by point in time with the narration, and the number at its head counts up. Labels per round:
  - 1 Sep: "6 new"
  - 15 Sep: "6 revised"
  - 1 Oct: "1 new · 5 revised"
  - 15 Oct: "3 new · 7 revised"
  - 1 Nov: "6 revised · 1 forgotten"
- **Graph B, Tolu's diesel run** (`dieselTurn[]`): share of diesel bills Tolu paid. **5/5 (100%) → 6/7 (86%) → 8/9 (89%) → 8/11 (73%) → 9/12 (75%).** Below each dot, the next-turn label: Ada → Emeka → Emeka → **Godspower** → **Godspower**. The last dot is blob `_x__n1nD…`, the same one opened in scene 4. Blob IDs per dot: `I8ZwMqGQ…`, `sofWTiGm…`, `t2XFkAIV…`, `qJdYZfI0…`, `_x__n1nD…`.
- **Graph C, settle speed** (`settleSpeed`): four lines, one per member, showing score out of 100.
  - Godspower: 90 → 92 → 93 → 92 → **95**
  - Tolu: 72 → 70 → 70 → 72 → 72
  - Ada: 59 → 58 → 65 → 61 → 58
  - Emeka: 32 → 27 → 26 → 32 → 31

  Emeka's line carries the label "typical delay ~10 days → ~9 days" at 15 Oct.
- **The forgetting beat** (`groceriesTurn[]`): a groceries dot appears at 15 Oct ("Godspower 3 of 6, next Emeka"), then at 1 Nov it's struck through and greyed: "No longer holds". That retirement is its own memory on Walrus.
- **Then:** cross-fade to a capture of the **How it learned** timeline on `/demo`, with 15 Oct expanded to show the before and after chips.
- **Judge point:** the learning loop, including forgetting, plotted straight from Mainnet memories. This covers the blog's "how it learned over time" and the Best Walrus Memory "memories that visibly change the product".

### 6. Verified, private (1:45–2:00)
- **On screen (Remotion):** four checkpoint blocks drop into a row, labelled "entries 1–10", "11–20", "21–30" and "31–37" (`ledger.checkpoints[]`), each with its blob ID. A teal line runs through them and each block flips to a ✓ as the line passes. It ends on "37 / 37 matched, hash for hash" (`ledger.verifiedEntries` / `ledger.totalEntries`). Below, a namespace string scrambles into `ss_g_fd36f984879028d5` with a lock icon and "SEAL encrypted".
- **Judge point:** tamper-evident memory and privacy awareness (integration depth and technical quality).

### 7. Settling through Tatum (2:00–2:25): the pipeline line and the balance lines
- **On screen, top half (Remotion):** six nodes in a row with a glowing pulse running along the line between them. Each node lights up as it's spoken:
  - **Build** (Tatum)
  - **Simulate** (Tatum)
  - **Sign** (wallet)
  - **Execute** (Tatum)
  - **Confirm** (Tatum)
  - **Receipt** (Walrus)

  Tatum nodes are blue and the Walrus node is teal.
- **On screen, bottom half** (`settlements[2]`, read through Tatum): three small line charts animate as "Confirm" lights up:
  - payer USDC steps down by exactly **0.05**
  - payee USDC steps up by exactly **0.05**
  - gas stays flat at **0 SUI**

  Caption: `9V57Dbu…QUV · checkpoint 339,178,369 · SUCCESS`. Then the receipt dot lands on Walrus with blob `TBoGRTytpS…`.
- **Results strip:** all 3 payments as tiles (`settlements[]`):
  - 0.01 USDC · checkpoint 339,135,513
  - 0.01 USDC · checkpoint 339,143,353
  - 0.05 USDC · checkpoint 339,178,369

  Each tile shows "0 SUI gas" and its Walrus receipt blob.
- **Then:** a 3-second capture of the review step in `/app/settle` ("0 SUI fee"), and the [transaction on Suiscan](https://suiscan.xyz/mainnet/tx/9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV).
- **Judge point:** Tatum does real on-chain work (build, simulate, execute, confirm), not decoration (integration and technical quality).

### 8. Check it yourself (2:25–2:40)
- **On screen (capture of `/status`):** scroll the live Tatum checks: chain identifier (Sui Mainnet), latest checkpoint, the known transaction's balance changes, a USDC balance, each with its latency.
- **Overlay:** a small latency sparkline drawn from the **values in this capture**. Don't invent numbers.
- **Then:** a fast terminal cut of `pnpm video:data` and the test run, with chips: "65 verified · 0 rejected", "66/66 blobs on Walrus Mainnet", "88 unit tests", "12 decision records".
- **Judge point:** technical quality and a demo judges can verify themselves (presentation).

### 9. Close (2:40–2:55): the results graph
- **On screen (Remotion):** a line rises from 0 to **69**, the memories on Mainnet (`mainnet.memories`). Halfway it crosses a dashed line labelled "10 required" (`mainnet.gate`). The counter at the head ticks up. Then three result chips land beside it: "65 verified · 0 rejected", "37 / 37 ledger entries", "3 payments · 0 gas". End card: the logo, **usepaddock.online**, **github.com/0xGp/Paddock**, and "Built with Tatum × Walrus".
- **Judge point:** the hard gates on screen, with somewhere to go next.

## Remotion visual prompt

Use this as the brief for the Remotion composition.

> A 1920×1080, 30 fps product video for **Paddock**, a shared-bills app that remembers. The style is calm, premium fintech: a light aqua-to-periwinkle gradient background (#E6FBFA → #DCE7FF) for app and graph scenes, and deep navy (#0F1D45 → #1F4FB8) for the opening and closing scenes. Accent teal #4FD4CF, ink #1B2340, muted ink #5B6478. The type is **Plus Jakarta Sans** (headings 600–700, body 500), with **Geist Mono** for hashes, digests, blob IDs and namespaces. Cards have 24 px radius, soft shadows, and white at 70% over the gradient, like the app.
>
> **All chart data is imported from `video/data/mainnet.json`; nothing is typed in by hand.** Every point carries the Walrus blob ID it came from, shown in small mono text under the dot when the line reaches it. A quiet source label sits in the bottom-left of every graph scene: "Source: Walrus Mainnet" or "Source: Sui Mainnet via Tatum".
>
> The hero motif is **a line that moves**. In every scene a single teal line carries the story: spend piling up across 37 bills, the learning curve climbing round by round, Tolu's diesel share bending down as the turn passes to Godspower, a pulse travelling through the payment pipeline, a line crossing the "10 required" threshold. Lines draw with an animated stroke-dashoffset (Remotion `interpolate` with `Easing.bezier(0.22, 1, 0.36, 1)`). Points land with a `spring` (damping 18). Numbers count up at the line's head. Never move linearly; nothing should take longer than 0.6 s except a line being drawn.
>
> App footage is a real screen capture of usepaddock.online, framed in a soft browser window with a 2° tilt and slow 1.0 → 1.04 zooms toward whatever the narration names. Highlight rings are teal, 3 px wide, and pulse once. Captions sit at the bottom, are centred on a frosted pill, and show the narration in short phrases. Each scene's length comes from its ElevenLabs clip (`getAudioDurationInSeconds`) plus 12 frames. A quiet, warm music bed at −24 LUFS ducks under the voice.

## Captures to record (1920×1080, browser at 100% zoom)

1. `/demo`: page load, the Memory card, the three learned cards, the memory switch off then on.
2. `/demo`: open "Diesel: Godspower", then the Walruscan blob page for `_x__n1nD3gleY_ZQduTJtcNYmFIhPUg7R0H3A4yOiDY`.
3. `/demo`: the "How it learned" timeline, with 15 Oct expanded.
4. `/app/settle`: the review step showing the 0 SUI fee (signed in, without paying, unless you choose a live take).
5. Suiscan: tx `9V57Dbu95yuikVhYysxreSg7vFL3PxFqzNJMgQkV5QUV`.
6. `/status`: the full page with live latencies.
7. Terminal: `pnpm video:data` from start to finish.

## ElevenLabs settings

- Model: `eleven_multilingual_v2`.
- Voice: a calm female voice that doesn't rush. The default is "Sarah" (`EXAVITQu4vr4xnSDxMaL`); a Nigerian-English female from the Voice Library also suits the Lagos story. Set the ID as `ELEVENLABS_VOICE_ID` in `.env.local`.
- Stability 0.6, similarity 0.8, style 0.05, speed 0.9, speaker boost on.
- Generate one clip per scene (`01-problem.mp3` … `09-close.mp3`) so Remotion can time each scene to its clip.
- The API key goes in `.env.local` as `ELEVENLABS_API_KEY` and is only read by the script that generates the audio.

## Building it

The video is a Remotion project in `video/`. Every step reads live Mainnet or the live site, so run them in order right before a final render:

1. `pnpm --filter @splitsense/video terminal`: runs `pnpm video:data` (fresh Mainnet read into `video/data/mainnet.json`) and `pnpm test`, and keeps their real output for scene 8.
2. `pnpm --filter @splitsense/video capture`: screenshots of usepaddock.online (`/demo` with memory on and off, the open diesel "Why?", the timeline, `/status`), Walruscan and Suiscan, using the local Chrome.
3. `pnpm --filter @splitsense/video voice`: one clip per scene with per-word timings. Uses ElevenLabs when `ELEVENLABS_API_KEY` is set (voice `ELEVENLABS_VOICE_ID`, default "George"); otherwise a macOS `say` stand-in with estimated timings. Unchanged clips are reused.
4. `pnpm --filter @splitsense/video render`: writes `video/out/paddock.mp4`. Scene lengths, captions and on-screen beats all follow the word timings.

Scene 7 shows the Suiscan page for the 0.05 USDC payment instead of a capture of `/app/settle`, which needs a signed-in wallet.

## Fact check

Every spoken claim, and where it comes from on Mainnet.

| Claim | Mainnet source (`video/data/mainnet.json` key) |
|---|---|
| Over 800 USDC (802.67), 37 bills, 1 Aug–28 Oct | 4 ledger checkpoints on Walrus (`spend`, `ledger.checkpoints`), converted at the rate in the group profile on Walrus (`currency`) |
| 65 memories recalled, each re-checked against its hash | Walrus Memory recall (`recall`: 65 / 65 / 0) |
| Whose turn / Coming up / Settle speed drawn from memory; memory off removes them | `/demo`, rendered from the same recall |
| Tolu paid 9 of the last 12 → Diesel: Godspower; its blob | `dieselTurn[4]`, blob `_x__n1nD3gleY_ZQduTJtcNYmFIhPUg7R0H3A4yOiDY` |
| 6 in round one, 35 by round five | `learning[]` |
| Tolu's diesel run 5/5 → 9/12; next turn → Godspower | `dieselTurn[]` |
| Emeka ~10 days → ~9 days | `settleSpeed.emeka` |
| Groceries rotation forgotten | `groceriesTurn[1].retired` |
| 4 checkpoints, 37 / 37 hash for hash | `ledger` |
| Every blob is on Walrus Mainnet | `blobs` (66 / 66 from the public aggregator) |
| Build, simulate, sign, execute, confirm through Tatum; receipt after confirmation | README "Tatum"; `docs/PROOF.md` §2 |
| 3 real payments, 0 gas | `settlements[]` (status SUCCESS, `gasSui` 0, exact ± USDC), read through Tatum |
| `/status` checks: chain, checkpoint, known tx, USDC balance | `/status` (live) |
| 88 unit tests, live Tatum tests, 12 decision records | `pnpm test`, `pnpm test:live`, `docs/adr/` |
| 69 memories on Mainnet | `mainnet.memories` (relayer `listNamespaces`) |
