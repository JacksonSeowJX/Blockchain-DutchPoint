# DutchPoint demo video script

The demo video, `DutchPoint.mp4` (submitted with the code), follows this script. Its hands-on part is a real
auction on the Sepolia testnet on 6 November 2026, run through the website with MetaMask and recorded on
screen. Every figure in it can be checked on Etherscan
([evidence 18](../ai-audit/evidence/18-sepolia-run-3.txt)).

- **Format:** 1920x1080, under 10 minutes, with burned-in subtitles.
- **Narration:** one AI voice throughout (the macOS voice "Evan"), generated one sentence at a time so the
  subtitles match the audio.
- **Footage:** segment 2 is cut from the screen recording of the live run, cropped to the website, with a
  caption bar naming each step. Waiting is sped up, and the caption bar shows by how much. The other
  segments are slides made from real command output and screenshots of the live site and Etherscan.

## Running order

| # | Time | Segment | Shows |
| --- | --- | --- | --- |
| 1 | 0:00-1:03 | Architecture and design | Title card, architecture slide |
| 2 | 1:03-4:36 | Live run on Sepolia | The 6 Nov recording, 12 captioned steps |
| 3 | 4:36-5:12 | Undersubscribed sale and burn | `npm run demo` scenario 2, the 23 Oct Sepolia token |
| 4 | 5:12-5:54 | Security and testing | Reentrancy demo, tests, coverage, CI |
| 5 | 5:54-6:46 | AI audit: what the AI got wrong | Report summary, F1, A1 |
| 6 | 6:46-7:16 | Deployment and verification | Live site on GitHub Pages, verified source, the three Sepolia runs |
| 7 | 7:16-7:38 | Close | End card |

Total 7:38.

## What the brief asks for, and where it is

| Requirement (brief) | Where |
| --- | --- |
| Video starts with a quick introduction to the architecture/design | 1 |
| Detailed hands-on demo of the solution deployed | 2 (on Sepolia, start to withdrawal), 3 |
| ERC20 token; auction engine in a separate contract | 1 (diagram), 2 step 12 (both contracts) |
| Exactly 20 minutes; price descends over time | 2 steps 1, 2, 5, 8 |
| Uniform clearing price; everyone pays the same | 2 steps 6, 9, 10 |
| Sell out at or above reserve, or burn unsold tokens | 2 step 6 (sell-out), 3 (burn) |
| Token claims; automatic refund of surplus ETH | 2 steps 6 and 7 (refund in the same transaction), 10 (claims), 11 (proceeds) |
| Bonus: reentrancy resistance | 4 |
| Tricky points: block-time decay, the bid that bridges the threshold, safe refunds, burning | 2 steps 2, 6, 7; 4; 3 |
| Rubric: AI audit quality, testing, docs and UX | 4, 5, 6 |

---

## Script

### 1. Architecture and design

**On screen.** The title card (names: Jackson Seow Jia Xian, Alfred Fong Wei Hao, Kalaiselvan Sanjeev), then
the architecture slide (the same diagram as Figure 2 of the AI Audit Report).

**Narration**

> This is DutchPoint, by Group DutchPoint: Jackson, Alfred and Sanjeev. DutchPoint launches our ERC20 token,
> Gavora, or GVRA, through a 20-minute Dutch auction. Falling prices, one clearing price.
>
> Fixed-price token sales lead to gas wars and poor price discovery. Here, the price starts high and falls
> in a straight line to a reserve price, and bidders commit ETH. The moment the committed ETH can buy the
> whole supply, the auction sells out, and every winner pays that same clearing price.
>
> On-chain there are two contracts. GavoraToken is a fixed-supply, burnable ERC20 with no owner and no
> minting. DutchAuction holds the tokens for sale, prices every bid from the block timestamp, refunds the
> surplus of the bid that sells out, and burns whatever is left unsold.
>
> Off-chain there's just a static React app. It reads the contracts over JSON-RPC and sends every
> transaction through MetaMask. No backend, no database. Let's watch a real auction on the Sepolia testnet.

### 2. Live run on Sepolia

**On screen.** Cut from the screen recording of the live run (Jackson's screen, 6 Nov 2026, 03:20 to
03:45 Singapore time). Each step below is one shot, and its bold line is the caption bar's text. The three bidder wallets were on a second laptop, so
their bids appear as they reach the chain. Bidders are never named.

**Narration**

> **Step 1 · Jackson, the issuer, starts the 20-minute auction**
> This is a live run on the Sepolia testnet, recorded on 6 November. We deployed a fresh auction of 1,000
> GVRA. Jackson, the issuer, starts the 20-minute auction and confirms in MetaMask. Once the block is mined,
> the auction is live.
>
> **Step 2 · Price falls every block: 0.0001 → 0.00002 ETH/GVRA in 20 min**
> The price comes from the block timestamp. It falls in a straight line from 0.0001 ETH per GVRA to a
> reserve of 0.00002 over the 20 minutes.
>
> **Step 3 · Bid 1 · 0.01 ETH at 0.000092 ETH per GVRA**
> Two minutes in, the first of three bidder wallets, on a second laptop, commits 0.01 ETH. Every bid
> carries an on-chain minimum: if the auction filled up before the bid was mined, the contract would cancel
> it rather than sell less than the quote.
>
> **Step 4 · Bid 2 · 0.025 ETH at 0.0000792 ETH per GVRA**
> At 5 minutes 12, a second bidder commits 0.025 ETH. Each bid becomes a ridge on the surface, and each
> row's time links to its transaction on Etherscan.
>
> **Step 5 · No new bids, but each price drop makes the ETH cover more**
> For five minutes there are no new bids, yet the meter keeps filling: at a lower price, the 0.035 ETH
> already committed covers more of the supply.
>
> **Step 6 · Bid 3 sells out at 10:36 · 0.0226 accepted, 0.0074 refunded**
> At 10 minutes 36, the third bidder sends 0.03 ETH. At that second, all 1,000 GVRA cost 0.0576 ETH, and
> only 0.0226 was still uncovered. So 0.0226 is accepted, the auction sells out, and the price stops
> falling. The earlier bids are filled in full.
>
> **Step 7 · Etherscan: the 0.0074 ETH refund is in the same transaction**
> Jackson opens that transaction on Etherscan. The 0.0074 ETH surplus went straight back to the bidder
> inside the same transaction, and the logs show the bid, the clearing price and the refund.
>
> **Step 8 · Sold out · claims open after the full 20 minutes**
> Bidding is now closed, but claims open only after the full 20 minutes, so we wait for the window to end.
>
> **Step 9 · Finalized at one clearing price: 0.0000576 ETH per GVRA**
> At 20 minutes the auction is ready to finalize. Anyone can do it; here Jackson does, and the page follows
> each stage: confirm in your wallet, waiting for the block, confirmed. All 1,000 GVRA are sold, and none
> are burned.
>
> **Step 10 · Claims at one price: 173.61, 434.03 and 392.36 GVRA**
> Then each bidder claims from their own wallet, and the counter climbs to three of three: 173.61, 434.03
> and 392.36 GVRA. The first bidder pays the same clearing price as the last, so their 0.01 ETH buys about
> 60 percent more than at the price when they bid.
>
> **Step 11 · Proceeds: 1,000 × 0.0000576 = 0.0576 ETH to Jackson**
> Claims round down, so one indivisible unit of GVRA is left over, and the page offers to burn it. Jackson
> withdraws the proceeds: 0.0576 ETH, exactly 1,000 GVRA times the clearing price.
>
> **Step 12 · Sale details: both contracts, linked to Etherscan**
> The Sale details tab links both contracts, so anyone can check every step of this run on-chain.

The page shows prices to six decimal places, so the clearing price 0.0000576 appears as 0.000057 on screen
(and 0.0000792 as 0.000079). The captions and narration give the exact values; see
[The numbers](#the-numbers).

### 3. Undersubscribed sale and burn

**On screen.** A terminal panel with scenario 2 of `npm run demo` (its real output), then the
23 Oct Sepolia token on Etherscan with a total supply of 750 GVRA.

**Narration**

> What if demand falls short? Our scripted local demo covers that case. A single bidder commits 1 ETH, and
> the 20 minutes run out. The auction settles at the 0.005 ETH reserve, so 1 ETH buys 200 GVRA, and
> finalize burns the other 800: the token's total supply drops to 200. We saw the same on Sepolia on
> 23 October: two bids totalling 0.015 ETH settled at the 0.00002 reserve and bought 750 GVRA, and the other
> 250 were burned.

### 4. Security and testing

**On screen.** `npm run demo` scenarios 4 and 5; `npm test` (63 passing) and `npm run test:frontend`
(32 passed); the coverage table; the green CI runs on GitHub Actions (Slither).

**Narration**

> Security. The brief's bonus asks for reentrancy resistance, so we show it against a baseline. In our
> deterministic demo, the same attacker contract re-enters a deliberately vulnerable auction ten times and
> walks away with 11 ETH: its own 1 ETH plus everyone else's bids. Against DutchAuction the re-entry fails,
> and it gets only its own 0.75 ETH refund, thanks to checks-effects-interactions and ReentrancyGuard.
>
> Behind that: 63 contract tests, including fuzz and invariant tests, 32 frontend tests, 100% line coverage
> of both contracts, and Slither in CI, which fails the build on any Medium or High finding.

### 5. AI audit: what the AI got wrong

**On screen.** The AI audit report's summary on GitHub; the F1 before/after tables
(`evidence/02` and `04`); the failing test (`evidence/01`); A1 (`evidence/12`).

**Narration**

> We built with three AI tools: ChatGPT planned, Codex wrote the first version, and Claude Code reviewed
> it. The worst bug, F1: Codex shared the supply pro-rata, so a late 100 ETH whale took 91% of the
> tokens. We caught it because ChatGPT's plan disagreed, and we wrote a test that failed on Codex's code.
> Now the whale gets only what's left: 111 GVRA, with 98.75 ETH refunded.
>
> The reviewing AI made mistakes too. A team member's independent Codex review found six defects in Claude
> Code's frontend. In A1, the quote promised a minimum that a partly filled bid doesn't get: a 1 ETH bid
> quoted at 88.89 GVRA could end up with 69.77. Rewording made it honest; the on-chain minimum that every
> bid now carries made it true.

### 6. Deployment and verification

**On screen.** The live site on GitHub Pages; the auction's *Contract* tab on Etherscan with its verified
source; a slide of the three Sepolia runs.

**Narration**

> Everything here runs on public infrastructure. The contracts are on Sepolia, with their source code
> verified on Etherscan and Sourcify, so anyone can match the code to what runs on-chain. The site is a
> static build on GitHub Pages, and it reads the chain without a wallet. The run you saw was our third on
> Sepolia: on 23 October a sale ended at the reserve and burned 250 GVRA, and on 3 November one sold out
> after 15 minutes with a 0.003 ETH refund.

### 7. Close

**On screen.** The end card: repository and live-site URLs, the three names, equal contribution.

**Narration**

> So: one 20-minute auction, one clearing price for everyone, the crossing bid refunded in the same
> transaction, unsold tokens burned, and every bid protected on-chain. DutchPoint was built by Jackson,
> Alfred and Sanjeev, who shared the work equally. The README shows how to run it, and the AI Audit Report
> has the full evidence. Thanks for watching.

---

## The numbers

Live run, 6 Nov 2026 (auction `0xAB0f2B36150eC6D8C9f096CFA592eEDF82A8A8a8`, token
`0x2f3C5e8B944fE3E67d40cDF9a68d3B1512D02Fbf`): 1,000 GVRA, price p(t) = 0.0001 − 0.00008 × t / 1200 ETH per
GVRA, t in seconds from the start (block time 19:20:24 UTC, 5 Nov). Event times are from the chain
([evidence 18](../ai-audit/evidence/18-sepolia-run-3.txt)).

| Event | t | Check |
| --- | --- | --- |
| Bid 1: 0.01 ETH | 120 s (2:00) | p = 0.0001 − 0.000008 = 0.000092 |
| Bid 2: 0.025 ETH | 312 s (5:12) | p = 0.0001 − 0.0000208 = 0.0000792; total 0.035 |
| Bid 3: 0.03 ETH sent | 636 s (10:36) | p = 0.0001 − 0.0000424 = 0.0000576; 1,000 × p = 0.0576; room 0.0576 − 0.035 = 0.0226 accepted; 0.03 − 0.0226 = 0.0074 refunded |
| Finalize | 1248 s | 1,000 GVRA sold, 0 burned |
| Claims | | 0.01 / 0.0000576 = 173.61; 0.025 / 0.0000576 = 434.03; 0.0226 / 0.0000576 = 392.36 (sum 1,000, less one unit of rounding dust) |
| Proceeds | 1452 s | 1,000 × 0.0000576 = 0.0576 ETH |

"About 60 percent more": at its own bid price, 0.01 ETH buys 0.01 / 0.000092 = 108.70 GVRA; at the clearing
price it buys 173.61, which is 1.597 times as much.

Burn (segment 3): `npm run demo` scenario 2, one 1 ETH bid, reserve 0.005: 1 / 0.005 = 200 claimed, 800
burned, supply 200. 23 Oct on Sepolia (report §6): bids of 0.01 and 0.005 ETH, both settled at the 0.00002
reserve: 0.015 / 0.00002 = 750 claimed, so 250 burned (total supply 1,000 → 750).
