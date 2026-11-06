# Codex prompt P01: the first-build prompt, in its original wording

Sanjeev's first prompt to the Codex desktop agent, sent on **25 September 2026 at 20:38:05 SGT**. It
produced the first implementation, "FairLaunch" (commit `0a75a78`).

- **Source:** P01 in Sanjeev's Codex prompt log, in the version he shared on 7 November 2026, which gave
  each prompt in its original wording. His [current shared log](https://drive.google.com/file/d/1C8xUpdNeH2EkowMe0tveSRG3fY06Z_vd/view)
  gives every prompt as an edited paraphrase, so this copy keeps the exact text that the AI audit report
  quotes (§3, F2 and F4).
- **Changes:** none to the wording. The Markdown escape characters left by the export (`\*` and `1\.`)
  are removed.

~~~text
Build my SC4053 Blockchain Technology development project: Option 2, Dutch Auction.

The project is called FairLaunch. It is an educational Ethereum token-launch dApp with a descending auction price, a uniform final clearing price, token claims, safe ETH refunds, and burning of unsold tokens.

Read project.pdf, Document.pdf, and Document 2.pdf first. Inspect the existing workspace and any AGENTS.md instructions before making changes. Use the supplied lecture material where relevant. Treat the main project brief as the primary source for functional requirements, and record any conflicts with accompanying documents.

I want a manageable, complete project for a team of two or three students, with clean code, an attractive frontend, meaningful tests, and evidence for the required AI Audit Report.

Proceed beyond planning and implement the project in stages. Make reasonable reversible decisions independently. Record ambiguities and assumptions instead of silently changing assignment requirements.

1. Establish the specification before implementation

Create:

* docs/spec.md
* docs/architecture.md
* docs/assumptions.md
* docs/ai-development-log.md

Map each assignment requirement to a planned feature and test.

The auction must:

* Use an ERC20 project token.
* Keep auction logic separate from token logic.
* Accept ETH commitments.
* Use a deterministic descending price bounded by a reserve price.
* Have a configured duration of exactly 1,200 seconds.
* Apply one final clearing price to all successful participants.
* Handle contributions that cross the clearing threshold.
* Support token claims and surplus ETH refunds.
* Burn genuinely unsold tokens without burning tokens owed to participants.
* Demonstrate resistance to reentrancy.

The brief has two ambiguities:

* “Exactly 20 minutes” versus clearing earlier when sufficient capital is committed.
* “Automatically process refunds” versus safe user-triggered withdrawals.

Document these as questions for the TA. For an initial working implementation, use a clearly labelled assumption that early clearing may lock the outcome, while settlement becomes available at the scheduled 20-minute endpoint. Calculate refunds automatically and expose safe user-triggered claims. Keep these policies isolated so they can be revised easily.

Do not claim these assumptions have been approved.

2. Define and verify the auction mathematics

Before coding the auction, specify the equations and work through numeric examples for:

* Price decay.
* Clearing condition.
* Final clearing price.
* Individual token allocation.
* Accepted ETH and surplus refunds.
* Issuer proceeds.
* Unsold token burn.
* Integer rounding and any remaining dust.

Use an ETH-budget commitment model consistent with the brief. Do not accidentally implement a pay-at-submission-price sale.

Clarify that a falling price can increase the tokens purchased by an earlier commitment; an earlier bidder does not necessarily receive a refund merely because the price falls.

Handle clearing caused by price decay even when no new contribution arrives. A late finalisation transaction must not arbitrarily change the economic result or overallocate tokens.

Choose and document a deterministic policy for a bid crossing the clearing threshold. Explain whether excess ETH is rejected, partially accepted, or credited for refund.

Use integer arithmetic, explicit units, and appropriate full-precision multiplication and division. Do not use JavaScript floating-point arithmetic for financial calculations.

Do not proceed with internally inconsistent allocation rules. Verify worked examples and conservation properties before connecting the frontend.

3. Keep the scope small

Use:

* Solidity with a pinned stable compiler.
* OpenZeppelin ERC20 and appropriate security utilities.
* Hardhat with one compatible TypeScript testing setup.
* React, Vite, TypeScript, ethers, and MetaMask.
* A local development network first.

Check current official documentation for compatible versions and import paths.

Implement one auction per deployment with an immutable sale configuration after starting. Avoid auction factories, upgradeable proxies, cross-chain support, secondary trading, oracles, and unnecessary backend services.

Ensure the auction is fully funded with its token inventory before it starts. Limit minting so the configured sale supply cannot be changed during the auction.

Suggested contracts:

* LaunchToken.sol
* DutchAuction.sol
* Test-only malicious receiver or reentrancy attacker contracts

4. Build a polished frontend

Use a restrained, professional launch dashboard with clear typography and responsive layouts.

Include:

* Wallet connection, account and network state.
* Token name, symbol, sale supply and auction status.
* Current indicative price, starting price and reserve price.
* A descending price chart and 20-minute countdown.
* Total ETH committed.
* A contribution form with a clear explanation of what a commitment means.
* An estimated allocation explicitly labelled as provisional.
* Permissionless finalisation when eligible.
* A settlement receipt showing deposited ETH, accepted cost, refund and tokens received.
* Claim controls, transaction states and useful error messages.
* Burned token amount after settlement.

Read authoritative auction state from the contract. A browser countdown or chart must not determine settlement.

Handle rejected wallet requests, account changes, wrong networks, pending transactions, and page refreshes.

For creative presentation, include a compact “How this auction works” explanation and a visual comparison of early and late participants paying the same final price.

5. Implement safe settlement

Use checks-effects-interactions and appropriate reentrancy protection.

Avoid unbounded loops over bidders during settlement, refunds or burning.

Keep participant entitlements independent of claim order. Prevent duplicate claims and withdrawals.

Separate accounting for:

* Participant commitments.
* Refund liabilities.
* Token entitlements.
* Issuer proceeds.
* Rounding residuals.

The issuer must never withdraw ETH needed for outstanding refunds. Do not treat the contract’s raw ETH balance as an exact measure of tracked commitments because unsolicited ETH may be present.

A recipient that rejects ETH must not block settlement or other users. Document how that participant can recover funds safely.

Do not burn unclaimed token entitlements as though they were unsold inventory.

6. Test the important failure cases

Include tests for:

* Price at the start, during the auction and at the deadline.
* Monotonic price decay and the reserve floor.
* Rejection before opening and after closing.
* No contributors.
* Partial sale at the reserve price.
* Clearing before the deadline.
* Clearing caused by time passing without a new bid.
* A contribution crossing the clearing threshold.
* Multiple contributions by one wallet.
* Small amounts, rounding and dust.
* Uniform final pricing.
* Claim-order independence.
* Duplicate claims and withdrawals.
* Early and repeated finalisation.
* Unauthorised configuration changes and withdrawals.
* A receiver that rejects ETH.
* A malicious receiver attempting reentrancy.
* Conservation of ETH and token accounting.

Use local time manipulation to exercise the actual 1,200-second configuration. Do not silently shorten the submitted auction duration.

Add property or fuzz tests where useful, particularly for supply limits and refund solvency.

Run compilation, contract tests, frontend type checking and production build. Run Slither if available, investigate its findings, and report any checks that could not be executed.

7. Preserve evidence for the AI Audit Report

Maintain the report’s eight required sections:

1. Initial specification and system scope.
2. Development methodology and AI tooling.
3. Specification engineering and prompt logs.
4. Initial AI-generated architecture.
5. Problems discovered and vulnerability analysis.
6. Validation process and testing strategy.
7. Improvements and refinements.
8. Lessons learned.

Preserve representative generated revisions and genuine failing tests before fixes where practical.

For every actual major issue, record:

* The likely reason it occurred, clearly labelled as an inference where necessary.
* Why it matters.
* What changed.
* Evidence that the fix works.

Do not invent bugs, prompt histories, human contributions, test results, or audit findings. Label intentionally vulnerable teaching contracts separately from actual implementation defects.

8. Make the result easy to run and demonstrate

Deliver:

* Complete source code and dependency lockfiles.
* README with installation, local deployment, wallet setup and demo instructions.
* Deployment and deterministic demo scripts.
* Environment variable example with no secrets.
* Requirement-to-test checklist.
* AI audit draft based on actual work.
* A demo script lasting under 10 minutes.
* Known limitations and outstanding TA questions.

The demonstration should show a successful sale, an undersubscribed sale with token burning, surplus refund handling, and a blocked reentrancy attempt.

Use only local accounts and test funds. Do not deploy to mainnet or require paid services.

Start by reading the files, writing the specification and checking the auction mathematics. Then implement the contracts and tests, connect the frontend, and complete the documentation. Continue until the local project runs, or clearly identify a concrete blocker.
~~~
