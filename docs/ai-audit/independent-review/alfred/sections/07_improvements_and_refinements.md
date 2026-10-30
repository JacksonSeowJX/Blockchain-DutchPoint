# 7 Improvements and Refinements

Our project evolved from the FairLaunch implementation in `0a75a78` to the DutchPoint baseline in `c36cb0c`. The repository attributes the initial implementation to Codex and documents later Claude Code assistance. Recoverable source versions confirm the changes below, but do not establish individual authorship of every change. Human decisions are described only where the edited development record supports them. Historical test results are distinguished from checks performed during this audit. [E08, E34, E43, E47]

## Contract behavior and accounting

The most substantial revision changed how the auction accepts a crossing bid. The original contract accepted the full amount and allocated a cleared sale proportionally across all commitments. This allowed a large final contribution to dilute earlier bidders. In the recorded example, a 100 ETH final bid received approximately 909.09 of 1,000 tokens after earlier contributions of 6 and 4 ETH. Commit `20e24b1` caps acceptance at remaining capacity. In the corresponding scenario, only 1.25 ETH is accepted from the final bidder, producing approximately 111.11 tokens. The remainder is returned or credited if payment fails. [E36, E49]

This is a confirmed policy revision, not simply a correction to an unequivocal original requirement. The initial specification described pro-rata allocation, while the surviving planning material described a different approach. According to the edited session record, our team requested an explanation of the alternatives and approved the revised rule. That decision protects previously accepted commitments from the specific crowd-out scenario. It does not establish that arrival-order allocation is universally fair or that the TA approved the interpretation. [E29, E31, E34, E36]

Three implementation corrections accompanied this revision. The following table connects the original limitation to the resulting behavior. All four historical regression cases were introduced in `35253ce` before the fix in `20e24b1`. Archived outputs record four failures followed by four passes. This audit did not replay those Solidity tests. [E12, E49]

| Improvement | Original limitation | Modification and outcome |
| --- | --- | --- |
| Crossing-bid acceptance, H01 | Full acceptance could dilute earlier commitments under pro-rata settlement | Acceptance is capped at capacity and surplus is separated from commitments |
| Time-clearing reads, H02 | Read methods could continue reporting an active sale after price decay had met the clearing condition | Derived clearing views expose the time-based outcome before a transaction persists it |
| Deadline status, H03 | Cleared status took precedence over the deadline, hiding the normal frontend finalization action | Deadline priority exposes awaiting-finalization status while direct finalization remains permissionless |
| Independent proceeds, H04 | Each bidder's settlement released that bidder's portion of issuer revenue | Accepted proceeds become withdrawable after finalization without waiting for individual claims |

The accounting refactor separated token claims, refund credits and proceeds. The previous `_settleAccount` combined these responsibilities. The revised `claimTokens` records the claim before transferring tokens, while `withdrawRefundTo` handles existing credit and `withdrawIssuerProceeds` uses accepted commitments minus prior withdrawals. This removes the inactive-bidder dependency for revenue without consuming refund liabilities. Unclaimed tokens can still delay the final remainder burn, which intentionally waits for all participants. [E42, E43, E49]

The revised clearing calculation also uses upward rounding where needed to avoid allocating more than the sale inventory. Historical mutation records show failures when that rounding is changed downward. The constructor now rejects a supply whose entire reserve-price value is below one wei. These are concrete arithmetic safeguards, although they do not establish correctness for all uint256 configurations. The extreme starting-capacity candidate P04 remains unresolved at EVM level. [E15, E54, E57, E58]

## Security controls and authority

Security improvements should be separated from controls that already existed. The initial auction already used ReentrancyGuard and effects-before-transfer accounting on relevant paths. Removing redundant restoration writes immediately before a revert simplified the code, but did not repair a demonstrated reentrancy exploit. Commit `031b753` instead improved the evidence by adding a deliberately vulnerable control and a reusable attacker demonstration. The production auction and the insecure fixture are distinct contracts. [E14, E55]

The token refactor in `1ba8883` removed unused Ownable functionality and the `maxSupply` field while introducing Gavora metadata. Both versions minted at construction without a later mint function. The confirmed improvement is a smaller interface that better expresses the token's role, not the removal of an exploitable administrator mint function. In the auction, owner checks remain on start and proceeds withdrawal. The redundant immutable issuer identity was removed, and current ownership governs those privileges. No historical access-control bypass was established. [E42, E43]

Dependency maintenance in `c55fcc1` separated browser runtime dependencies from build tooling and updated packages, including Vite from 8.3.1 to 8.3.5. The saved dependency record reports a reduction from ten advisories to zero at that time. Classification alone does not remove build-time exposure, and the audit has not verified present advisory status or independently reproduced every reachability judgment. [E17, E63]

## Frontend, wallet and delivery refinements

Commit `c689e3c` replaced the combined App implementation with components, wallet and auction hooks, display mathematics and error helpers. This provides separate locations for bidding, positions, settlement, history and price visualization. It also supports read-only RPC access instead of requiring a connected wallet for all snapshots. Improved reviewability is a reasonable inference from the separation, but no maintenance-time measurement exists. [E33, E43, E44]

| Change and evidence | Earlier limitation | Result and boundary |
| --- | --- | --- |
| Dashboard and transaction handling, `c689e3c` | Wallet, reads and rendering were combined in the original App | Components and hooks separate responsibilities, with wallet, mining, completion and failure stages. This does not cover every background rejection |
| Deployment and offline states, `4d88495` | Missing deployments and unreachable RPCs lacked suitable guidance, and switching could target an undeployed chain | Dedicated states explain availability and restrict switch choices to bundled deployments |
| Event scanning, `388399e` | One large query assumed the RPC would accept the full historical range | Queries use 10,000-block chunks. This addresses the recorded provider-range problem, not reorganisation recovery |
| Wallet and theme controls, `9fef77c` | Token import required manual steps and theme choice followed system behavior | A wallet token-display request and persistent theme selector were added. The existing sell-out shortcut was made clearer |
| Sale explanation, `c36cb0c` | The earlier dashboard offered less explicit sale and position context | Sale details, share-of-supply display, explorer links and an FAQ were added. Share of supply is a position metric, not social sharing |

These changes are confirmed in source and supported by the edited prompts and development log. The wallet refinements followed the recorded local MetaMask walkthrough, which exposed difficulty importing the correct token and finding existing controls. Commit `9fef77c` uses deployment-derived token metadata through `wallet_watchAsset`. Its commit record describes mock-wallet browser validation, but the complete driver is absent. Token display in a wallet is not itself a token transfer. [E41, E45, E50, E59, E63]

Deployment tooling also became network-configurable in `4c991e6`, and `9d828ae` added static Pages publication. The folder reorganization in `49a0d59` grouped frontend, mocks and documentation. These are delivery and organization improvements, not a replacement of the two-contract architecture or proof of public contract deployment. The committed public deployment map remains empty. [E39, E43, E46]

## Validation and gas evidence

The project added regressions, a vulnerable reentrancy control, fuzz and invariant properties, static analysis and CI. Commits `35253ce`, `031b753`, `7d4a531` and `2c450c4` establish these additions. They broaden the strategy from selected scenarios to generated sequences and negative controls. The current inventory contains 53 test definitions, while the earlier coverage record contains 52 passing tests because it predates the gas test. Neither number is a fresh audit execution of the contract suite. [E57, E58]

Commit `da81b1e` added a gas-scaling test for five operations at four bidder populations. Saved results show unchanged costs across those populations, while a planted claim loop makes the test fail. This supports the bounded-cost design objective. Since the initial implementation already avoided bidder-wide settlement loops, it would be inaccurate to describe this as a demonstrated conversion from linear to constant-cost settlement. No like-for-like historical benchmark establishes a general reduction in production gas consumption. The improvement is measured regression protection. [E38, E55, E58]

Our documented review process includes requests for plans, explanations of economic choices and approval of selected changes. Later records also describe AI review of delegated work. Those activities support a qualified account of engineering oversight, not a claim that every revision received independent human security review. Team responsibilities and review artifacts remain open questions. [E34, E40, E59]

The refinements have not eliminated every problem. Stage 6 reproduced five narrow frontend counterexamples and passed four additional mathematical tests, but could not run the contract toolchain or frontend build successfully because dependencies were absent. C01–C05 remain open and P01–P04 retain their stated verification limits. Audit-only checks are additional evidence, not fixes or historical team tests. [E60–E62]
