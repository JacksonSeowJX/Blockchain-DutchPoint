# 5 Problems Discovered and Vulnerability Analysis

The audit identified confirmed historical problems, current frontend defects and several integration risks that require further testing. It did not demonstrate an unauthorized fund-extraction vulnerability in the current production contracts. This is a bounded finding from source review and isolated local checks, not a declaration that the application is secure. The detailed finding register in `../audit_findings.md` records the affected functions, causes, impacts, severity, fixes and verification limits for each issue. [E49–E56]

The review covered both production contracts and all three test-only contracts, the auction's state and transfer paths, wallet synchronization, transaction submission, data refresh and the relevant UI components. We distinguish code inspection from archived execution records and from checks executed during this audit. Five new checks exercised actual frontend mathematics or narrowly extracted source logic. They did not deploy contracts or interact with a live network. No application source or existing test was modified. [E51, E52, E55]

## Findings overview

Severity reflects impact within this project. High denotes substantial allocation or asset consequences, Medium denotes material functional or decision-making impact, and Low denotes limited usability, reporting or configuration impact. Candidate severity remains provisional until the relevant behavior is reproduced.

| Finding | Severity | Classification | Current position |
| --- | --- | --- | --- |
| H01 Oversized final bid dilutes earlier participants | High under the adopted allocation policy | Confirmed historical economic problem | Changed in `20e24b1` |
| H02 Reads miss time-based clearing | Medium | Confirmed historical defect | Fixed in `20e24b1` |
| H03 Cleared status hides finalization readiness | Medium | Confirmed historical defect | Fixed in `20e24b1` |
| H04 Bidder inactivity strands their share of proceeds | Medium | Confirmed historical defect | Fixed in `20e24b1` |
| H05 Event query exceeds provider range assumptions | Medium | Historical source defect with narrated failure | Bounded in `388399e` |
| H06 Switch action targets an undeployed chain | Low | Confirmed historical source defect | Fixed in `4d88495` |
| C01 Pending quote incorrectly promises a minimum | Medium | Current source-verified functional defect | Open |
| C02 Sell-out shortcut truncates capacity | Low | Current source-verified functional defect | Open |
| C03 Negative amount lacks an eligibility guard | Low | Current source-verified validation gap | Complete input path still needs testing |
| C04 Refund credit appears as paid surplus | Low | Current source-verified reporting defect | End-to-end receiver case still needs testing |
| C05 Background wallet sync drops errors | Low | Current source-verified error-handling defect | Browser recovery still needs testing |
| P01 Mixed or stale account/network snapshots | Medium provisional | Current potential integration defect | Controlled race test required |
| P02 Orphaned event history after a reorg | Low provisional | Current potential integration defect | Reorg/reset test required |
| P03 Chain change during transaction submission | Medium provisional | Current potential transaction risk | Wallet interleaving test required |
| P04 Unrepresentable starting capacity | Low provisional | Current extreme-configuration risk | EVM parameter test required |

All current items remain unfixed in this audit. Source-confirmed gaps are not represented as observed wallet incidents, deployed exploits or lost funds. [E49–E56]

## Historical problems and their corrections

The clearest historical chain concerns allocation. The original contract accepted the full final contribution and divided the token supply proportionally across all commitments. In the archived example, earlier participants committed 6 and 4 ETH before a 100 ETH crossing bid. The final bidder obtained about 909.09 of the 1,000 tokens under the initial policy. The revised rule accepts only the remaining 1.25 ETH at the crossing price and allocates about 111.11 tokens to that bidder. [E12, E49]

This was an economic policy problem relative to the arrival-order requirement later accepted in the recorded review. The initial specification itself described pro-rata allocation. It would therefore be inaccurate to explain H01 solely as an agent misimplementing an unambiguous instruction or to call all pro-rata auctions insecure. Missing primary requirements and approval records still limit that judgment. The High rating describes the magnitude of dilution under the adopted policy, rather than inheriting the old report's severity without qualification. [E29, E31, E36]

Three further regressions addressed implementation behavior. H02 arose because read functions relied on persisted clearing fields even when falling prices had already closed bidding. H03 gave clearing priority over the elapsed deadline in `status()`, preventing the initial interface from exposing its normal finalization action. H04 accrued proceeds only as individual bidders settled. A bidder who never settled could strand that bidder's accepted portion, while already settled portions could still become withdrawable. [E23, E37, E49]

Commit `35253ce` adds tests before the main fix in `20e24b1`. Archived output records four failures before the correction and four passes afterwards. These records and the matching changes provide evidence of historical remediation. They are not tests newly executed during Stage 5. Direct contract finalization remained possible in H03, and the later proceeds accounting removes the participant dependency in H04. [E12, E49]

Frontend history also shows operational corrections. H05 requested an entire unscanned event range, which conflicted with the provider restriction described in the commit record. `388399e` introduces chunking and incremental progress. H06 offered a default network even when it lacked a deployment, and `4d88495` makes that choice deployment-aware. Source differences confirm both changes. The audit did not independently reproduce the historical provider failure or verify present remote hosting. [E39, E50]

## Current frontend findings

C01 is the most consequential current functional finding. `quoteBid` caps the expected accepted amount using capacity at the displayed time, while the bid panel promises that the user will receive at least the resulting token estimate. A pending transaction has not secured that capacity. The source contains the following computation and label.

```typescript
const accepted = amount < view.capacity ? amount : view.capacity
```

```text
You receive at least
```

The code excerpt omits only its terminating punctuation. With 10 ETH already committed against 1,000 tokens, a new 5 ETH bid is quoted at approximately 333.33 tokens at 400 seconds. If executed at 600 seconds, the lower price leaves only 2.5 ETH of capacity and the same transaction corresponds to 200 tokens plus a 2.5 ETH surplus. No competing transaction is needed. The isolated check executes the repository's actual display mathematics and confirms this reduction. The contract's partial-fill rule is consistent with it. A timed EVM execution remains outstanding. [E51]

The distinction is between accepted commitments and pending bids. Once a commitment has been accepted, a falling final price can increase its allocation. Before acceptance, a crossing bid's accepted amount can shrink. The UI should not extend a guarantee for the first case to the second. This is a Medium reporting and decision-making defect, not evidence that the contract distributes the wrong amount under its own rule. [E42, E51]

C02 concerns transaction input precision. The sell-out shortcut truncates capacity to six decimal places. The checked example converts 0.123456789 ETH into 0.123456 ETH, leaving a nonzero shortfall at the displayed state. A display formatter is therefore being used to construct an amount that the shortcut describes as exact. Preserving transaction precision and shortening only visible labels would address the cause. No correction was applied. [E51]

C03 concerns validation before submission. The bid-button predicate rejects zero but does not reject a negative parsed amount. Its balance check also does not identify this case. The isolated check confirms that negative input to the predicate remains eligible and produces a negative quote. The ethers parser and wallet were not executed, so the specific end-to-end failure remains unverified. The appropriate conclusion is a Low validation gap, not the possibility of sending negative ETH on-chain. [E18, E52]

C04 arises at the boundary between events and presentation. The history component labels the difference between the submitted and accepted amounts as refunded. The contract can instead retain that surplus as a credit if the receiver rejects ETH. Since the history reads only the contribution event, it cannot distinguish those outcomes. This is a confirmed reporting mismatch. The contract already tracks a credit and permits withdrawal to an alternative recipient, so the finding does not imply that the credited funds were lost. [E19, E52]

C05 concerns wallet errors. User-initiated connection catches exceptions, but background restoration and account/chain listeners discard the promise returned by `sync`. A rejecting provider request therefore has no corresponding handler at those call sites. The extracted function check confirms rejection propagation. A mounted browser test is still needed to establish the complete recovery experience and visible symptoms. [E52]

## Contract controls and unresolved risks

The production refund and proceeds paths check external-call success. Refund withdrawal clears the caller's credit before sending ETH, and a failed withdrawal reverts. Crossing-bid push failure creates credit instead of requiring the recipient to accept payment. Token claims record completion before calling SafeERC20. Guarded entry points and these accounting choices provide evidence against the simple repeated-withdrawal attack demonstrated by the deliberately vulnerable mock. They do not prove resistance to every adversarial interaction. [E42, E55]

Access checks are also applied at the contract layer. Starting and withdrawing proceeds require the current owner. Finalization and final remainder burning deliberately allow other callers but enforce their state conditions. No current bypass was identified. Token supply is minted at construction, and the project token has no owner or later mint function. The absence of a reentrancy modifier on `start` contradicts overly broad documentation but does not by itself establish an exploitable path. [E05, E22, E55]

Arithmetic inspection found explicit nonzero reserve and supply checks, ordered prices, bounded elapsed time and Math.mulDiv-based calculations. Claims and finalization do not iterate over all bidders. The main arithmetic candidate retained as P04 concerns extreme constructor inputs whose starting capacity cannot fit uint256, rather than a demonstrated overflow with the supplied sale defaults. Compatibility with arbitrary external tokens is also outside the verified pairing of DutchAuction and GavoraToken. [E54, E55]

P01–P03 remain integration candidates. Concurrent latest-state reads can span blocks, old asynchronous loads can outlive account or chain changes, and event caching has no reorganisation rollback. The transaction wrapper also does not explicitly revalidate its captured destination against the latest signer network immediately before submission. These source observations justify targeted tests. They do not establish that a wallet will allow a wrong-chain transaction or that users have seen corrupted state. [E20, E53]

Several apparent security findings should not be overstated. The old withdrawal code's writes immediately before a revert were redundant, rather than a demonstrated exploitable reentrancy path. The earlier protected reentrancy test still tested combined defenses even though a later vulnerable control improved the demonstration. An inactive bidder can delay remainder burning by design, but no longer gates the issuer's accepted proceeds. Ownership renunciation and donated assets are operational boundaries requiring explicit expectations rather than automatic vulnerability labels. [E21–E24, E55]

## Verification limits

The audit-only script and outputs are retained under `../validation/`. Five checks passed after correcting a TypeScript-extraction error in the harness. The failed first attempt is preserved and does not represent an application test failure. The final record includes runtime version, baseline revision and source hashes. It is narrowly scoped evidence of frontend logic, not a substitute for browser or contract integration testing. [E56]

No current dependency scan, Solidity suite, Slither run or historical EVM replay was performed. Dependencies were absent and no installation was attempted. The existing coverage, gas and invariant results remain historical and bounded by their test models. The detailed register records the tests needed to resolve each candidate and the fixes suggested for confirmed gaps. Stage 5 ends with this classification and evidence record. Stage 6 has not begun.
