# Testing results and validation ledger

Stage 6, 2026-10-23, single-agent review at `c36cb0cebe803db5ee138d89fe2e21e8cfb33ad5`. This ledger distinguishes source inventory, historical team records and newly executed audit checks. A definition count is not a passing-test count. An unavailable tool is not a failed contract assertion.

## Local execution environment

New discovery reports Windows PowerShell, Node v25.9.0 and npm 11.12.1. `node_modules` is absent. Hardhat cannot be resolved from the project. Slither, solc, Forge, TypeScript and Vite are not on PATH. The targeted npm-cache query returned no matching entries for Hardhat, ethers, React, TypeScript or Vite. This does not prove that every unrelated cache is empty, but it gives no basis for an offline project installation. The project CI instead specifies Ubuntu and Node 24. Contract npm scripts also use POSIX environment-assignment syntax.

No dependencies were installed or downloaded. No compiler, contract-test runner, live deployment or browser wallet was started. The attempted frontend build stopped at its missing compiler. Audit-only Node checks were practical because the math module has no third-party imports and Node can strip its TypeScript types. [E60]

## Commands executed during Stage 6

All commands ran from the repository root. `validation/stage6_run.ps1` preserves the runner and writes individual logs with UTC timestamps, command text, working directory and exit code. Its overall exit code reflects completion of the recording script, not universal success. The individual exit codes below are authoritative. [E60, E61]

| Record | Exact command or recorded operation | Exit | Result |
| --- | --- | --- | --- |
| `validation/stage6/01_environment.txt` | `node --version`, `npm --version`, `git rev-parse HEAD`, PowerShell `Get-Command` and `Test-Path` discovery as retained in the runner | 0 | Environment recorded, absent tools identified |
| `validation/stage6/02_cache.txt` | `npm cache ls hardhat ethers react typescript vite` | 0 | No matching entries printed, not a test pass |
| `validation/stage6/03_hardhat_resolution.txt` | `node --input-type=module -e "console.log(import.meta.resolve('hardhat'))"` | 1 | `ERR_MODULE_NOT_FOUND`, preflight failure before any contract test |
| `validation/stage6/04_build.txt` | `npm run build` | 1 | `tsc` not recognized, Vite build not reached |
| `validation/stage6/05_stage5_recheck.txt` | `node ai_audit_report/validation/stage5_checks.mjs` | 0 | Five source-level audit checks passed again |
| `validation/stage6/06_math_tests.txt` | `node --test ai_audit_report/validation/stage6_math.test.mjs` | 0 | Four Node tests passed, zero failed |

The runner itself was invoked as `& ./ai_audit_report/validation/stage6_run.ps1`. Test names, counts and file hashes were also collected by PowerShell source enumeration into `validation/stage6/test_inventory.json`. It inventories all seven existing suite files using anchored `it` and `testFuzz_`/`invariant_` declarations. Inventory generation does not execute those tests.

No `npm run test`, Solidity compilation, coverage, gas measurement, Slither analysis or `npm audit` was executed in Stage 6 because the required toolchain was absent. No success is claimed for those commands. Repeatedly invoking unavailable tools would not improve verification.

## Existing test inventory and behavioral coverage

| File | Definitions | What the tests are designed to validate | Important boundary |
| --- | --- | --- | --- |
| `test/DutchAuction.test.ts` | 34 | Constructor checks, funding/start authorization, prices, bids, clearing, lifecycle, settlement, claims, refunds, proceeds and asset conservation | Source reviewed, not newly executed |
| `test/AuditRegressions.test.ts` | 4 | H01 crowd-out, H02 time clearing, H03 status ordering, H04 proceeds independent of claims | Archived failure/fix chain exists, not replayed here |
| `test/GavoraToken.test.ts` | 5 | Metadata/18 decimals, initial mint, absence of mint/owner APIs, zero supply rejection, own burn and unauthorized burnFrom rejection | Does not replace review of the full inherited ERC20 implementation |
| `test/Reentrancy.test.ts` | 2 | Same attacker drains vulnerable fixture but receives only its own refund from production auction | Specific attack/control pair, not exhaustive callback exploration |
| `test/Gas.test.ts` | 1 | Five operations measured after 1, 10, 50 and 100 prior bidders, spread no more than 1% | Fixed operation states and crowd sizes |
| `test/solidity/DutchAuctionFuzz.t.sol` | 3 | Monotonic bounded price, uniform/conserving settlement and exact time-clearing price | Six bidders, fixed sale/prices, bounded amounts/gaps |
| `test/solidity/DutchAuctionInvariant.t.sol` | 4 | ETH backing, token conservation, supply bound and uniform claims through handler actions | Five EOA actors plus rejecter, fixed economics and restricted actions |

There are 46 Mocha definitions and seven Solidity properties, totalling 53 source definitions. Solidity fuzzing is configured for 1,000 runs and invariants for 256 runs with depth 50 and `failOnRevert`. These are configured budgets, not new executed case counts. The properties use forge-std through Hardhat's Solidity test runner. No separate Foundry configuration or executed Forge workflow was established. [E57]

The 34 auction cases were reviewed across every nested test group.

| Area | Successful-path assertions | Failure or boundary assertions |
| --- | --- | --- |
| Configuration and start | Inventory funding and one authorized start | Zero token/supply, zero reserve, equal prices, sub-wei sale value, non-owner start, missing funding, repeated start |
| Price | Exact values at start, 400, 800 and 1,200 seconds, monotonic samples | Reserve floor, post-deadline values, neutral pre-start views |
| Contributions | Plain ETH receive, repeated address aggregation, crossing fill, immediate refund, emitted amounts and balance changes | Before start, zero value, deadline, both crossing and time-cleared rejection |
| State and clearing | Five-state sequence, remaining capacity, existing-commitment quote, stored final price | Deadline priority, clearing time not before contributing capital, ceil rounding and token-supply bound |
| Finalization | Zero-demand burn, partial reserve sale, both clearing modes | Before start, early call even after sell-out, repeat call |
| Claims and dust | Uniform per-bidder allocation, selected reverse claim order, all-claim dust burn | Before finalization, no commitment, duplicate claim, outstanding claims, repeated empty burn |
| Refunds | Rejecting receiver gets credit, alternate recipient receives ETH, credit cleared once | Zero recipient, rejection preserves credit, duplicate withdrawal, attacker reentry rejected |
| Proceeds | Owner withdrawal to selected recipient, credits remain backed, full lifecycle accounting | Before finalization, unauthorized caller, zero recipient, rejecting recipient rollback, duplicate withdrawal |

These are meaningful assertions using custom errors, balances, event fields and persisted state. Tests create both token and auction and exercise contract-to-contract behavior, so many nominal unit tests also perform local EVM integration. A complete lifecycle script supplies further demonstration scenarios. Neither those tests nor the script exercise the React interface automatically. [E57]

## Archived team validation

| Record under `docs/ai-audit/evidence/` | Recorded outcome | Interpretation |
| --- | --- | --- |
| 01 and 03 | Four regressions fail before the fix and pass afterwards | Historical evidence for H01–H04, corroborated by commits `35253ce` and `20e24b1` |
| 02 and 04 | Crowd-out allocation changes from about 909.09 to 111.11 tokens for the final bidder | Scenario-level policy correction, not general fairness proof |
| 05 | Vulnerable fixture drains 11 ETH, protected auction pays only 0.75 ETH of legitimate refund | Historical positive/negative attack control, not a production exploit |
| 06 | M1 floor-rounding mutation causes six failures, M2 raw-balance proceeds mutation causes three, restored properties show seven passing | Tests can detect these planted faults, but exact reusable mutation patches/seeds are missing |
| 07 | 45 Mocha plus seven Solidity properties pass, production contract line/statement coverage 100% | 52-test snapshot before gas case. Overall recorded line/statement totals are 99.57%/99.64%, with an uncovered mock line. No branch-coverage claim |
| 08 | Original auction has 19 analyzer results, revised auction 14, token zero, vulnerable fixture two | Static detector output requires triage. Dependency paths are filtered and four equality checks suppressed inline |
| 09 | Measured five-operation gas costs identical at four crowd sizes, planted-loop claim rises from 163,417 to 410,719 gas and fails | Supports selected gas-scaling claim and test sensitivity, not all states or arbitrary receivers |
| 10 | Historical dependency-audit result reports zero vulnerabilities after package changes | Not a fresh advisory or dependency-reachability assessment |

Slither CI installs version 0.11.6 and Solidity 0.8.28, then gates Medium/High findings with `--fail-medium`. Filtering dependencies and suppressing equality warnings narrow what the gate can establish. The original post-call writes before a revert should not be treated as a demonstrated reentrancy exploit merely because a detector flagged them. [E16, E24, E58]

CI runs compile, coverage, type checking, build and demo in one job, with Slither in another. Pages publication has its own build dependency rather than a dependency on that validation job. Configuration proves an intended automation path, not a successful current remote run. No CI run artifacts were retrieved during Stage 6. [E26, E58]

## Manual testing and review evidence

The development log describes headless Chrome checks using a mock wallet and a separate October 22 local MetaMask session. The latter begins on chain 56, switches to Hardhat Local, records a 1 ETH bid and a sell-out contribution, advances time, finalizes, claims and withdraws issuer proceeds. The log reports 80 tokens from the earlier 1 ETH commitment and 12.5 ETH total issuer proceeds. These are narrated local test outcomes. This audit did not reproduce the session or authenticate transaction receipts. The successful accepted-bid example does not test C01's still-pending crossing quote. [E59]

The same records describe viewport/theme checks, token-import feedback, clipboard/focus emulation, and subsequent UI changes. Screenshots and summaries exist, but a committed Playwright, Cypress, Vitest or comparable repeatable frontend test suite was not found in the tracked test/configuration inventory. TypeScript checking and Vite build success cannot establish wallet behavior, race safety, correct refund labels or valid input handling.

Recorded prompts show our team requesting a plan, approving selected changes and requesting teammate review. Later entries describe direct-main work and main-agent review of subagent output. Those records establish reported decisions and review activities, not complete independent peer review. Reviewing README claims or another agent's diff should not be presented as a full security review by all team members. Q05, Q07–Q08 and Q19 retain these evidence gaps. [E34, E40, E59]

## New audit checks and finding status

The five Stage 5 checks were rerun once in Stage 6 to establish the current execution baseline. All passed their assertions, which means they reproduced the recorded logic gaps, not that those gaps were fixed.

| Finding or behavior | Stage 6 result | Remaining limit |
| --- | --- | --- |
| C01 pending minimum quote | Reproduced the 333.333333333333333333-to-200 token decrease using actual math functions | No EVM transaction or rendered wallet timing test |
| C02 sell-out input | Reproduced truncation and underfill | No rendered button/transaction test |
| C03 negative eligibility | Exact predicate enables a negative parsed amount and math returns a negative quote | ethers parsing and wallet encoding not exercised |
| C04 refund label | Exact history calculation reports surplus without payment-status input | Rejecting-receiver UI integration not exercised |
| C05 wallet error | Extracted sync body rejects with mock provider, background callers have no catch | Mounted hook and user recovery not exercised |
| Display lifecycle | New test passes Pending, Active, Cleared, exact deadline, Finalized and zero-demand price cases | Tests frontend model, not contract bytecode |
| Display price bounds | New test checks every integer second from 0 to 2,400 and selected exact prices | Fixed configuration, no randomized parameter proof |
| Accepted commitment estimate | New test checks 1,200 timestamps and finishes at 600 tokens for a 6 ETH accepted commitment in a fixed-demand scenario | Explains why C01 must not be generalized to already accepted bids |
| P04 extreme arithmetic | New test verifies reserve-value bound and unrepresentable starting capacity using BigInt | No constructor or Solidity Math.mulDiv executed, candidate remains provisional |

P01–P03 remain untested integration candidates. H01–H06 retain historical/source validation only. No finding was fixed or closed by these checks. The new tests are retained under the audit directory, outside the existing test suite. Node's experimental type-stripping warning appears in the recheck log and did not cause a failing exit. [E61]

## Testing gaps and next validation priorities

1. Reproduce C01 using a local wallet delay and EVM timestamps, and validate C02–C05 through the rendered UI and actual ethers version.
2. Use controlled delayed RPC replies, account/chain switches and reorgs to test P01–P03. Include failed wallet requests, rejected transactions, replaced transactions and network loss during receipt waits.
3. Exercise extreme constructor parameters for P04, ownership transfer/renunciation, receiver gas behavior, token/ETH donations and long-lived unclaimed balances if included in the agreed scope.
4. Expand the invariant action space before claiming universal conservation. The handler cannot claim as its rejecting receiver, does not burn final dust, transfer ownership, force ETH, donate tokens or burn held tokens. Preconditions also turn many randomized invalid calls into no-ops, so negative behavior relies on explicit unit cases.
5. Compare frontend and contract math on identical snapshots. Testing either independently, especially when both implement the same formula, can preserve a shared misunderstanding.
6. Retain machine-readable build/CI outputs, seeds and mutation patches. The existing mutation examples show sensitivity to selected faults, not a mutation score for the entire project.

The exact next stage remains subject to user authorization. These are recommended validation targets, not new tests claimed as completed. Stage 6 is an assessment of the current strategy and available execution evidence, not a substitute for full toolchain validation. [E62]
