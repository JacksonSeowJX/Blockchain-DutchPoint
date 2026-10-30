# Audit findings register

Updated through Stage 6 at `c36cb0cebe803db5ee138d89fe2e21e8cfb33ad5`, inspected on 2026-10-23 by one agent. The original Stage 5 assessments below are preserved, with new validation recorded at the end. This register separates historical defects, current source-verified defects and candidates requiring integration testing. No live-network activity occurred. Application code and existing tests were not changed.

Severity describes project impact, not a CVSS score. High means substantial economic allocation failure or asset risk. Medium means material functional failure or misleading financial decisions. Low means limited usability, reporting or configuration impact. Candidate severities are provisional. Confirmed source behavior does not mean a browser or EVM reproduction was performed.

## Summary

| ID | Finding | Severity | Time and status | Verification |
| --- | --- | --- | --- | --- |
| H01 | Oversized final bid dilutes prior allocations | High under the adopted arrival-order policy | Historical, changed in `20e24b1` | Source and archived regression/PoC records |
| H02 | Read functions miss time-only clearing | Medium | Historical, fixed in `20e24b1` | Source and archived regression records |
| H03 | Cleared status hides deadline readiness | Medium | Historical, fixed in `20e24b1` | Source and archived regression records |
| H04 | Inactive bidders strand their share of issuer proceeds | Medium | Historical, fixed in `20e24b1` | Source and archived regression records |
| H05 | Bid-history query exceeds provider range assumptions | Medium | Historical, bounded in `388399e` | Diff confirmed, provider failure narrated |
| H06 | Network-switch action can target an undeployed chain | Low | Historical, fixed in `4d88495` | Diff confirmed |
| C01 | Pending-bid quote is incorrectly described as a minimum | Medium | Current, open | Actual math module counterexample and UI source |
| C02 | Sell-out shortcut truncates transaction input | Low | Current, open | Extracted formatter and actual quote function |
| C03 | Negative amount is not rejected by bid eligibility logic | Low | Current, open validation gap | Exact predicate and quote checked, parser/wallet integration pending |
| C04 | Unpaid surplus credit is labelled as refunded | Low | Current, open | Exact history expression and contract branch reviewed |
| C05 | Background wallet synchronization drops rejections | Low | Current, open | Extracted sync body rejects, call sites lack handler |
| P01 | Stale or mixed reads can survive account/chain changes | Medium provisional | Current candidate | Source gap confirmed, race reproduction pending |
| P02 | Event cache has no reorganisation rollback | Low provisional | Current candidate | Source gap confirmed, reorg reproduction pending |
| P03 | Transaction destination is not revalidated against current wallet chain | Medium provisional | Current candidate | Source gap confirmed, wallet race reproduction pending |
| P04 | Constructor permits parameters whose starting capacity exceeds uint256 | Low provisional | Current configuration candidate | Arithmetic analysis, EVM validation pending |

H01–H04 correspond to the former report's F1–F4. The old F5 and F6 are assessed separately below and are not promoted into production exploits. C01–C05 have narrow source-level verification. None demonstrates unauthorized extraction of funds from the current production contracts. [E49–E56]

## Historical findings

### H01 Oversized final bid dilutes prior allocations

**Affected code and root cause.** At `0a75a78`, `contracts/DutchAuction.sol::_contribute` accepts the full bid and `_finalSettlement` allocates a cleared sale as `commitment * saleSupply / totalCommitted`. A large last commitment changes the denominator for earlier bidders. This was an explicit pro-rata policy, not an integer-overflow defect.

**Evidence and impact.** Regression F1 and archived evidence 01–04 show Alice and Bob committing 6 and 4 ETH, followed by a 100 ETH bid at 700 seconds. The old PoC awards the final bidder about 909.09 of 1,000 tokens. Under the adopted policy, only 1.25 ETH is needed and the corresponding allocation is about 111.11 tokens. Excess commitment can be refunded, but the bidder still needs capital upfront and pays gas. High severity reflects substantial dilution relative to the subsequently accepted policy. It is not proof that pro-rata auctions are inherently vulnerable or that the missing course brief prohibited them.

**Fix and verification.** `35253ce` adds the regression and `20e24b1` caps accepted commitment at remaining capacity and returns surplus. Matching before/after outputs are historical records, not new executions. Classification is a confirmed historical economic design problem under the revised requirement. [E12, E29, E31, E36, E49]

### H02 Read functions miss time-only clearing

**Affected code and root cause.** Initial `DutchAuction.status` and `currentPrice` rely on stored `clearingTime`, while elapsed-time clearing is synchronized in transaction paths. Read-only calls do not independently derive it.

**Evidence and impact.** Regression F2 commits 10 ETH against 1,000 tokens and advances to 900 seconds. Clearing should have occurred at 800 seconds and 0.01 ETH per token, but the original status still reports Active. Users can see an available auction and a falling quote even though bidding is economically closed. Medium severity reflects conflicting interaction state, not a successful bypass of bid checks.

**Fix and verification.** `20e24b1` adds derived `clearingState` to views and bidding. Archived evidence records the regression failing before and passing after. Current source contains the correction. No fresh EVM replay was performed. [E12, E37, E49]

### H03 Cleared status hides deadline readiness

**Affected code and root cause.** Initial `DutchAuction.status` returns Cleared before checking whether the scheduled deadline has passed.

**Evidence and impact.** Regression F3 shows the original result remaining Cleared where AwaitingFinalization is expected. The initial interface gates finalization on the latter status, preventing the normal UI route to settlement after an early sell-out. Direct contract finalization remains available, so this is not an unavoidable contract-level lock. Severity is Medium.

**Fix and verification.** `20e24b1` puts the deadline check before clearing. Current source and historical passing output corroborate the fix. Browser behavior was not rerun. [E12, E37, E49]

### H04 Inactive bidders strand their share of issuer proceeds

**Affected code and root cause.** Initial `DutchAuction._settleAccount` increases `issuerProceedsAvailable` only when a participant settles. The owner's withdrawal reads that accumulator.

**Evidence and impact.** Regression F4 finalizes after a 2 ETH commitment but attempts withdrawal before that participant claims. The archived run reverts with `NoProceedsAvailable`. A lost-key or inactive bidder can strand that bidder's accepted contribution. Other participants' settled portions can already be available, so the old report's claim that all revenue waits for every claim is too broad. Severity is Medium because settlement liveness for issuer revenue depends on unrelated participation.

**Fix and verification.** `20e24b1` uses accepted total commitments minus previous issuer withdrawals after finalization. Refund liabilities remain separate. The correction is source-confirmed and historically tested, not replayed here. [E23, E37, E49]

### H05 Bid-history query exceeds provider range assumptions

**Affected code and root cause.** Before `388399e`, `frontend/src/hooks/useAuction.ts::load` requests all unscanned `ContributionReceived` logs in one range. Fresh browser sessions can request the entire deployment history.

**Evidence and impact.** The commit records a public endpoint rejecting ranges above its limit and the diff confirms the unbounded-range request. A sufficiently old deployment on such a provider loses its bid-history refresh. Medium severity concerns read availability. This audit does not verify the current provider limit or claim a recorded public auction actually suffered the failure.

**Fix and verification.** `388399e` introduces 10,000-block chunks and updates the scan cursor per successful chunk. The diff confirms mitigation of the identified range problem. It does not bound total history size or resolve P02. [E39, E50]

### H06 Network-switch action can target an undeployed chain

**Affected code and root cause.** Before `4d88495`, `frontend/src/App.tsx` directs an unsupported wallet to `defaultChainId` without confirming that chain has a deployment.

**Evidence and impact.** The diff replaces unconditional selection with a deployed default, another deployed chain, or no switch target. A user could previously complete the requested switch and still have no usable auction. Severity is Low, with no demonstrated transfer to a wrong contract.

**Fix and verification.** `4d88495` adds deployment-aware switching and an absent-deployment screen. The source change is confirmed, but the old UI interaction was not rerun. [E39, E50]

## Current source-verified defects

### C01 Pending-bid quote is incorrectly described as a minimum

**Affected code and root cause.** `frontend/src/lib/auctionMath.ts::quoteBid` computes `accepted = min(amount, view.capacity)` at the displayed time. `frontend/src/components/BidPanel.tsx` presents the resulting `minTokens` as “You receive at least”. Unlike an already accepted commitment, the pending bid's accepted amount is not fixed.

**Evidence and impact.** Local check C01 imports the actual `viewAt` and `quoteBid` functions. With 1,000 tokens, 10 ETH already committed and a new 5 ETH bid, the displayed price at 400 seconds is 0.015 ETH and the preview is 333.333333333333333333 tokens. At 600 seconds, price is 0.0125 ETH, remaining capacity is 2.5 ETH and the same submitted amount buys 200 tokens, with 2.5 ETH surplus. No intervening bid is needed. This contradicts the claimed minimum and can mislead a financial decision. Severity is Medium. Existing commitments can still have valid lower-bound estimates, so this finding does not invalidate `tokensOwed` for accepted funds.

**Fix and verification.** Open. No fix was applied. Describe pending output as an estimate and explain capacity changes, or separately design an enforceable minimum if required. Source and pure-function counterexample are confirmed. Contract execution and a timed wallet interaction remain untested. [E51]

### C02 Sell-out shortcut truncates transaction input

**Affected code and root cause.** `BidPanel` fills the input using `trimDecimal(formatEther(view.capacity), 6)`. `frontend/src/lib/format.ts::trimDecimal` truncates rather than rounding up or preserving full precision.

**Evidence and impact.** Local check C02 extracts the actual formatter. Capacity of 0.123456789 ETH becomes 0.123456 ETH, leaving 789,000,000,000 wei unfilled at that state. The actual quote function returns `clearsAuction = false`. Capacity below 0.000001 ETH can become zero. Price movement may sometimes hide the problem before mining, but does not make the shortcut exact. Severity is Low because the user can enter a fuller amount and funds are not misaccounted.

**Fix and verification.** Open. Preserve exact capacity when constructing transaction input and round only presentation text. The formatter and quote behavior were executed locally, without a browser or chain. [E51]

### C03 Negative amount is not rejected by bid eligibility logic

**Affected code and root cause.** `BidPanel` rejects only zero in `disabled: busy || amount === 0n || inputError !== ""`. `parseEthInput` delegates to ethers parsing and contains no positivity check. The balance comparison rejects only amounts above balance.

**Evidence and impact.** C03 executes the exact disabled expression with a parsed amount of negative 1 ETH and finds the action enabled. The actual quote function produces a negative token estimate. This confirms a missing validation guard, not a successful negative ETH transaction. The dependency parser, wallet serialization and rendered form were not executed. Severity is Low for an invalid-input path and confusing failure rather than on-chain theft.

**Fix and verification.** Open. Validate strictly positive amounts before quoting or enabling a bid. The predicate and arithmetic are locally verified. A browser test with the installed ethers version should verify the complete input path before describing a particular wallet error as observed. [E18, E52]

### C04 Unpaid surplus credit is labelled as refunded

**Affected code and root cause.** `BidHistory` calculates `bid.amount - bid.accepted` under a “Refunded” heading. `useAuction` loads only contribution events for history. `DutchAuction._refundSurplus` can instead emit `RefundCredited` when payment fails.

**Evidence and impact.** C04 executes the exact history expression on a 2 ETH contribution with 1.25 ETH accepted. It displays 0.75 ETH without any payment-success field. The same contribution event is compatible with a rejecting receiver retaining a credit on-chain. Existing tests contain that receiver path, but were not rerun. Severity is Low because the reporting is wrong while contract credit accounting remains available. The history is public, so this is not dependent on the UI itself supporting a contract wallet.

**Fix and verification.** Open. Label the column as surplus, or resolve refund and credit events explicitly. The source-level information loss is confirmed. An end-to-end rejecting-receiver history reproduction remains outstanding. [E19, E52]

### C05 Background wallet synchronization drops rejections

**Affected code and root cause.** `useWallet::sync` awaits `eth_accounts` and `eth_chainId` without catching rejection. Mount and account/chain listeners call it with `void sync()`. The user-triggered `connect` path does catch errors, so that protection must not be generalized to background synchronization.

**Evidence and impact.** C05 extracts the actual sync body, strips TypeScript types and supplies a provider whose request rejects. The rejection propagates. Source inspection confirms the background callers attach no rejection handler. A provider failure can leave stale state without the intended wallet error display. Severity is Low. The test confirms rejection propagation, not a mounted React unhandled-rejection event or a permanently unusable wallet.

**Fix and verification.** Open. Catch and expose background synchronization failures, clear invalid state where appropriate and guard against superseded requests. Full browser recovery behavior remains unverified. [E06, E52]

## Candidates requiring further testing

### P01 Stale or mixed reads can survive account and chain changes

**Affected code and root cause.** `useAuction::load` makes independent latest-state reads and `refresh` serializes calls with shared refs. Cleanup resets displayed state but neither cancels in-flight loads nor checks a provider/account generation before publishing results.

**Potential impact and severity.** A slow old request may repopulate state after switching accounts or chains. A refresh across a block boundary may combine accounting values from different blocks. Medium provisional severity concerns incorrect position/action presentation. No wrong-chain fund loss is established.

**Status and verification.** Current, no fix found or applied. Source gaps are confirmed and the manifestation is inferred. Reproduce with delayed provider responses and controlled account switches, then evaluate generation checks and pinned-block reads. [E20, E53]

### P02 Event cache has no reorganisation rollback

**Affected code and root cause.** `useAuction` advances `lastBidBlock`, appends logs and caches timestamps by block number. It does not retain block hashes, rewind a confirmation window or remove orphaned history after a reorg or same-provider local reset.

**Potential impact and severity.** Displayed bids could remain orphaned or replacement events could be skipped, while current contract state is read separately. Low provisional severity concerns history accuracy rather than contract accounting.

**Status and verification.** Current, no fix found or applied. Source omission is confirmed. A controlled reorg/reset test is needed before claiming a reproduced inconsistency. [E20, E53]

### P03 Transaction destination is not revalidated against current wallet chain

**Affected code and root cause.** `App::run` checks for a provider and deployment, then uses a captured deployment address with `getSigner`. It does not explicitly re-read and compare the signer chain/account to the selected deployment immediately before submission. UI-level gating reduces ordinary mistakes but is separate from submission-time validation.

**Potential impact and severity.** If a wallet changes chains while the interaction is pending, stale deployment metadata could be used. Whether ethers or the wallet rejects the operation, or an unintended address receives a transaction, is unverified. Medium provisional severity applies only if the race is reachable.

**Status and verification.** Current candidate, no fix applied. Test chain/account switching around signer acquisition and wallet confirmation with a mock provider. Do not claim a demonstrated wrong-chain transfer. [E45, E53]

### P04 Starting capacity can exceed uint256 for accepted deployment parameters

**Affected code and root cause.** `DutchAuction` constructor validates nonzero supply, reserve value and ordered prices, but does not constrain `saleSupply * startPrice / TOKEN_SCALE` to a representable result. `maxCommitmentAt` uses `Math.mulDiv`, which cannot return a result above uint256.

**Potential impact and severity.** For example, supply of `10^36` base units, reserve price of 1 wei per whole token and start price of `2^256 - 1` satisfy the explicit project checks at the mathematical level, but the starting capacity exceeds uint256. Such a deliberately extreme configuration may revert on bidding or capacity reads. Low provisional severity reflects deployer-selected invalid economics rather than an attacker changing the immutable configuration. Default deployment values are far below these bounds.

**Status and verification.** Current configuration candidate. Arithmetic reasoning is recorded, but no EVM deployment was executed and installed OpenZeppelin internals were not re-audited. Verify constructor and runtime behavior under the locked toolchain before promoting it to a confirmed runtime defect. [E54]

## False positives, boundaries and non-exploit concerns

| Concern | Assessment and basis |
| --- | --- |
| Production refund reentrancy | No current production drain demonstrated. Refund credit is cleared before calling the recipient, guarded entry points use nonReentrant, and failed withdrawals revert. The insecure interaction-before-effect path belongs to `contracts/mocks/VulnerableAuction.sol`, deliberately used in local tests. [E14, E55] |
| Old F5 restores state before reverting | Redundant writes in the initial withdrawal failure branches were removed in `20e24b1`. Reverting already rolls those writes back. This is cleanup and analyzer triage, not evidence of a successful production exploit. [E16, E55] |
| Old F6 means the original test proved nothing | A CEI-protected test still tests combined defenses. `031b753` adds a useful vulnerable control but does not prove the original production contract was exploitable. [E24, E55] |
| Missing guard on start proves reentrancy | `start` is owner-only, one-shot and checks token inventory. Its missing modifier contradicts broad documentation but does not alone establish an exploit. The supplied token is not an arbitrary callback implementation. [E22, E55] |
| Permissionless finalization or dust burn is an ownership bypass | These calls intentionally accept any caller and enforce deadline/claim conditions. Proceeds remain owner-only. [E42, E55] |
| Unchecked ETH transfer return value | Production ETH calls inspect success. Push failure creates credit, withdrawal failure reverts. The attacker mock intentionally inspects reentry success without forcing it to succeed. [E55] |
| Bidder-count gas denial of service | Production settlement has no loop over bidders. Historical gas tests are bounded evidence, not a proof about arbitrary token code or malicious receiver gas. Expensive callbacks can fail the caller's transaction without demonstrating a persistent global lock. [E15, E55] |
| Integer wraparound or division by zero | No such exploit was identified in the inspected paths. Solidity 0.8.28 arithmetic, positive reserve, ordered prices and Math.mulDiv reduce these risks. Result overflow for extreme configuration is separately retained as P04. [E54, E55] |
| Claims or dust can wait forever | Claims have no expiry and all claims gate the final burn. This is a deliberate protection of unclaimed tokens and a liveness tradeoff, not evidence that issuer proceeds are currently blocked. [E42] |
| Owner renunciation, foreign tokens or donated assets | Ownership renunciation can strand owner-only actions, foreign tokens can violate assumed semantics, and forced/unaccounted ETH has no sweep path. These are deployment/trust or asset-recovery boundaries, not demonstrated unauthorized drains. Broader conservation claims must account for donations and holder burns outside the current harness. [E21, E42, E54] |
| Stale token-watch success or omitted zero-bid burn control | `PositionPanel.tokenAdded` is local UI state, and `SettlementPanel` requires a positive participant count for its burn button. These are minor integration edge cases to test if wallet changes or post-finalization donations are in scope. They are not elevated to significant vulnerabilities here. [E56] |

The review did not identify an application backend, dynamic HTML injection path, proxy upgrade function, oracle feed, signature permit flow or ERC20 bidding allowance flow requiring unrelated checks. No claim is made that these absences prove general safety. Historical dependency-audit output was not treated as a current advisory scan. [E17, E42, E44]

## Verification record and remaining work

`validation/stage5_checks.mjs` executes the actual dependency-free auctionMath module and narrowly extracted source functions/expressions. `stage5_checks_output.txt` records Node v25.9.0, baseline HEAD, source hashes and five passing checks. The first attempt passed C01–C04 but failed when the audit harness tried to evaluate TypeScript syntax in the C05 extraction. That output is preserved in `stage5_checks_first_attempt.txt`. Stripping types in the audit harness fixed the harness error, after which all five checks passed. No application fix was made.

The Stage 5 checks are not React renders, ethers integration tests or EVM tests. Repository dependencies were absent. No installation, Solidity compilation, Slither run, fresh dependency scan, historical replay or live transaction was performed. The 53 test definitions and archived results retained their earlier evidence status. The Stage 5 checkpoint identified timed quotes, input handling, receiver history, wallet recovery, P01–P03 and P04 for later validation. [E49–E56]

## Stage 6 validation update

C01–C05 were rerun using the existing audit script and all five checks passed their counterexample assertions. Their scope remains source-level, not a mounted frontend or EVM reproduction. No finding was fixed or closed. H01–H06 remain historically corroborated rather than newly replayed. P01–P03 retain provisional status because no controlled browser/provider interleaving was executed.

A new audit-only Node test confirms that P04's chosen mathematical parameters satisfy the stated reserve-value bound while producing a starting-capacity result above uint256. This strengthens the numerical example but does not execute the constructor or Solidity Math.mulDiv. P04 remains a configuration candidate with Low provisional severity. Three further Node tests pass display lifecycle boundaries, price monotonicity/bounds and accepted-commitment estimates. The latter helps distinguish valid existing-position estimates from C01's pending-bid guarantee.

The frontend build was attempted and failed before compilation because TypeScript was missing. Hardhat package resolution also failed. These are environment failures, not new application findings. No original contract suite, EVM deployment, coverage or Slither run was executed, and no missing-tool result is reported as a pass. See `testing_results.md` and `validation/stage6/` for exact commands and outputs. [E60–E62]
