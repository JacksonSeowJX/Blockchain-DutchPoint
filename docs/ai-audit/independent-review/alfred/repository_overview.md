# Stage 1 — Repository overview

Checkpoint: **S1-2026-10-23**, Asia/Singapore. Baseline: `main` at `c36cb0cebe803db5ee138d89fe2e21e8cfb33ad5`.
This is an investigation record, not the final AI Audit Report. The pre-existing `docs/ai-audit/report.md` is evidence being assessed, not a conclusion adopted by this audit.

## Classification and scope

- **Confirmed**: directly observable in the inspected source, configuration, Git objects, or record. Confirmation that a log contains a result does not independently confirm execution of that result.
- **Inferred**: a reasoned interpretation of those records, including a possible runtime consequence not reproduced here.
- **Unverified**: requires missing primary material, execution, external records, or team confirmation.

Investigation was performed by one agent. Application code, tests, deployment records and Git history were not changed. No installation, application test run, contract deployment, transaction, checkout, fetch, or commit was performed. Local dependencies are absent; Node reports `v25.9.0`, npm `11.12.1`; Slither and Forge were not found on PATH. The npm contract scripts require POSIX shell syntax, as README explicitly documents. These are execution-readiness observations, not failed application tests.

## Purpose and implemented functionality

**Confirmed (E02–E06):** DutchPoint is a single-sale Ethereum dApp for the Gavora ERC20 token (GVRA). Users commit ETH to a descending-price, uniform-settlement-price auction. There is no application backend or database in the inspected tree. A static React client reads contracts/events over JSON-RPC and asks an injected wallet to sign transactions.

The default deployment parameters are 1,000 GVRA, start price 0.02 ETH/GVRA, reserve price 0.005 ETH/GVRA. They are environment-overridable; the contract duration is fixed at 1,200 seconds. `scripts/deploy.ts` deploys the token and auction, transfers inventory, and starts unless `START_AUCTION=false`.

| Lifecycle | Implemented behavior | Source locator |
| --- | --- | --- |
| Creation/funding | Token supply minted once to recipient; auction parameters immutable; funding checked before start | `contracts/GavoraToken.sol:constructor`; `contracts/DutchAuction.sol:constructor,start` |
| Start | Current owner starts one 20-minute window | `DutchAuction.start` |
| Bid | `contribute` and `receive` accept ETH; repeated bids aggregate per address | `DutchAuction._contribute` |
| Price | `startPrice - floor((startPrice-reservePrice)*elapsed/1200)`; reserve floor | `DutchAuction.priceAt` |
| Crossing bid | Accept only remaining capacity; push surplus back immediately, credit failed refund | `_contribute`, `_refundSurplus` |
| Time-only clearing | Derive price `ceil(totalCommitted*1e18/saleSupply)` and earliest integer timestamp, bounded by latest commitment | `_timeClearing`, `_earliestTimeAtOrBelow` |
| Settlement | Any caller finalizes after the full window, even if cleared earlier; fixes price and burns unsold tokens | `finalize` |
| Claim/refund | Each bidder claims once at `floor(commitment*1e18/finalPrice)`; credited refunds can go to another recipient | `claimTokens`, `withdrawRefundTo` |
| Revenue/dust | Owner withdraws accepted ETH after finalization, independently of claims; any caller burns remaining inventory after all participants claim | `withdrawIssuerProceeds`, `burnRemainderAfterAllClaimed` |

The UI supplies connection/network switching, live price/countdown, SVG price chart, demand meter, ETH bid quotes, sell-out shortcut, bid history, balances, claim/refund actions, owner actions, explorer/copy links, FAQ, theme selection and local time controls. Reads refresh on blocks and every 15 seconds; the displayed clock extrapolates from the latest fetched block. BigInt math mirrors contract rules for display; chart coordinates and formatted percentages also use JavaScript Number conversions.

## Requirements provenance

**Confirmed:** README and `docs/design/{spec,assumptions,requirements-checklist}.md` describe SC4053 AY2026–27 Semester 1 Option 2: separate token/auction, 20-minute descending price, uniform clearing, claims, surplus refunds, unsold-token burning and a reentrancy demonstration. They also describe a runnable code submission, AI report and video.

**Unverified (E03, Q01–Q03):** the actual assignment requirements, rubric, submission deadline and lecture citations. `project.pdf`, `Document.pdf`, `Document 2.pdf`, renamed “Dev Project Details”, and lecture slides are not present in this checkout. `*.pdf` is ignored. `assumptions.md` explicitly says its interpretations have not been approved by a TA. Early clearing with delayed settlement, arrival-order allocation and push-refund/pull-fallback acceptance must be checked against primary requirements.

## Technology inventory

Versions below are **confirmed declarations/resolutions in package.json/package-lock.json**, not freshly installed or independently validated releases.

| Layer | Technology/version | Evidence |
| --- | --- | --- |
| Contracts | Solidity 0.8.28; OpenZeppelin Contracts 5.6.1 | Pragmas, imports, lockfile |
| Contract toolchain | Hardhat 3.18.0; mocha-ethers toolbox 4.0.0; ethers 6.17.0 | Package files, config, test imports |
| Solidity testing | forge-std 1.9.7, locked Git revision `77041d2ce690e692d6e03cc812b57d1ddaa4d505` | Lockfile, Solidity test imports |
| Browser | React/react-dom 19.3.0; Vite 8.3.5; React Vite plugin 6.1.1 | Package files, Vite config, main.tsx |
| Language | TypeScript 7.0.2; strict TS configs, ES2022 target | Package files, tsconfig files |
| Security | Slither 0.11.6 with solc-select; npm audit historical logs | CI, Slither config, evidence 08/10 |
| Automation | GitHub Actions CI/Pages; POSIX packaging script | `.github/workflows/`, `scripts/package.sh` |
| Wallet | EIP-1193 injected `window.ethereum`, ethers BrowserProvider; wallet switch/add chain and watchAsset | `useWallet.ts`, `vite-env.d.ts` |

**Confirmed:** Solidity fuzz/invariant tests run through Hardhat scripts. forge-std usage does not establish a standalone Foundry/Forge pipeline; no `foundry.toml` was found. No WalletConnect, wagmi, viem, Truffle, Next.js or database integration was found in application imports/configuration. Mocha and Chai are consumed through the dependency tree rather than listed as separate direct runtime dependencies.

Default Solidity optimization is 200 runs. A production profile uses 500 runs and viaIR, but npm deployment commands do not explicitly select that profile. CI specifies Node 24, Ubuntu and Python 3.12 for Slither. Runtime dependencies are React, react-dom and ethers; build/test/contract dependencies are classified as dev dependencies. The lockfile resolves forge-std through Git/SSH, which is a fresh-install prerequisite to verify.

## Repository map and examined responsibilities

| Area | Files examined / purpose |
| --- | --- |
| Production Solidity | `contracts/DutchAuction.sol`, `contracts/GavoraToken.sol` — full auction and fixed initial token supply |
| Mocks | `contracts/mocks/ReentrancyAttacker.sol`, `RejectingReceiver.sol`, `VulnerableAuction.sol` — attack/rejecting-payment demonstrations; deliberately vulnerable fixture is separate from production deployment |
| App entry | `frontend/index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts` — bootstrap, provider selection, transaction lifecycle, wallet type declarations |
| Hooks | `useAuction.ts` — reads/event scan/cache; `useWallet.ts` — injected wallet; `useNow.ts` — clock; `useTheme.ts` — local preference |
| Libraries | `auctionMath.ts`, `contracts.ts`, `errors.ts`, `format.ts` — pricing, ABIs/deployments, readable errors, amount formatting |
| Transaction components | `BidPanel.tsx`, `PositionPanel.tsx`, `SettlementPanel.tsx`, `DevTools.tsx` — bids, claims/refunds, owner/finalization actions, local RPC time travel |
| Display components | `BidHistory.tsx`, `DemandMeter.tsx`, `PriceChart.tsx`, `SaleInfo.tsx`, `Header.tsx`, `HowItWorks.tsx`, `Faq.tsx`, `NotDeployed.tsx` |
| Styling | `frontend/src/styles.css` — custom responsive CSS, theme variables, breakpoints and accessible focus styling; no separate component framework |
| Generated data | `frontend/src/generated/{DutchAuction,GavoraToken}.json` — ABI exports; `deployments.json` is `{}` |
| Scripts | `deploy.ts`, `demo.ts`, `seed-local.ts`, `advance-time.ts`, `poc-crowd-out.ts`, `export-frontend.ts`, `lib/export-frontend.ts`, `package.sh` |
| Tests | Five TypeScript suites and two Solidity suites, detailed in E11 |
| Config | package/lock files, root and frontend TS configs, Hardhat, Vite, Slither, `.env.example`, `.gitignore`, both workflows |
| Documentation | README; all four design documents; existing audit report/log; all three prompt files; ten text evidence records; demo script |
| Images | Six tracked PNG screenshots catalogued as historical artifacts; not treated as proof of transaction execution or freshly reproduced UI behavior |

## Integration and trust boundaries

**Confirmed:** injected wallets hold signing authority; the frontend does not collect a private key. Read-only RPC is configurable. Local chain is 31337; Pages targets Sepolia 11155111. Only networks with deployment entries are treated as deployed by the UI. A display name for mainnet is present but is not a mainnet deployment record. No committed public deployment address exists (E07).

**Confirmed:** auction imports Ownable, SafeERC20, Math and ReentrancyGuard; ETH-moving entry points are guarded and refunds/proceeds are accounted separately. `start()` is not nonReentrant, contrary to architecture wording that every state-changing entry point is guarded. The inherited ownership API also exists in the ABI. Token compatibility assumes a standard 18-decimal burnable ERC20; the constructor does not enforce decimals/burn semantics. Deployment pairs it with GavoraToken.

**Confirmed:** one deployment supports one sale; no cancellation, factory, upgrade proxy, oracle or allowlist appears. Claims have no expiry, so unclaimed allocations can remain indefinitely and block the final dust burn. Ordering competition at sell-out and token trust are documented limitations. **Inferred:** correctness/security beyond the tested model still needs independent adversarial analysis; historical coverage and Slither outcomes are not security certification.

## What remains verifiable later

Repository evidence can establish source behavior, declared dependencies, test design, historical diffs and the content of AI records. Independent execution can check reproducibility and candidate UI issues (E18–E22). Team/external evidence is needed for authentic prompt transcripts, exact models, human responsibilities, TA approvals, CI run status, public deployment/source verification and the final video. See `questions_for_team.md`.
