# 6 Validation Process and Testing Strategy

The repository uses several complementary validation methods, with stronger automated coverage of contract behavior than of browser integration. It contains scenario tests, regression tests, Solidity properties, attack demonstrations, gas measurements, static analysis configuration and manual browser records. This section distinguishes those historical team activities from the checks newly executed during the audit. The command ledger and behavioral inventory are retained in `../testing_results.md`. [E57–E61]

## Frameworks and test organization

Contract testing uses Hardhat 3.18.0 with the Mocha/ethers toolbox, Chai assertions and ethers 6.17.0. TypeScript tests create simulated network connections, deploy the token and auction, control timestamps and assert contract errors, events, balances and storage. Solidity fuzz and invariant tests import forge-std and run through Hardhat's Solidity test configuration. This is not evidence of a separate Forge command-line workflow. Slither provides static analysis, while TypeScript and Vite support frontend type and build checks. [E46, E57]

The source inventory contains 46 Mocha test definitions and seven Solidity properties. The total of 53 is a count of definitions, not the number of tests passed during this audit. Fuzz tests are configured for 1,000 runs and invariants for 256 runs with depth 50. These settings describe intended test budgets rather than independently observed Stage 6 execution. [E57]

| Suite | Definitions | Main purpose |
| --- | --- | --- |
| DutchAuction | 34 | Configuration, lifecycle, pricing, bids, settlement, refunds, proceeds and conservation |
| AuditRegressions | 4 | Preserve corrected behavior for historical findings H01–H04 |
| GavoraToken | 5 | Metadata, initial supply, interface restrictions and burning |
| Reentrancy | 2 | Compare a deliberately vulnerable fixture with the protected auction |
| Gas | 1 | Compare five operation costs across four bidder populations |
| Solidity fuzz | 3 | Check price and settlement properties across bounded generated inputs |
| Solidity invariants | 4 | Check accounting and allocation through generated handler sequences |

Many of the scenario tests combine token and auction contracts, so they also validate local contract integration. A successful claim, for example, depends on auction accounting and the token transfer. This does not extend to the React-to-wallet path, which requires a different integration environment. [E57]

## Successful transactions and rejection behavior

The auction suite checks funded start, plain ETH contributions, repeated contributions by one address, partial acceptance of a crossing bid and immediate surplus payment. It verifies emitted amounts and balance changes rather than merely checking that the call returned. Finalization cases cover no demand, an undersubscribed reserve-price sale, early clearing and clearing caused only by elapsed time. Claim tests check common-price allocation, a selected reverse claim order and rounding-dust disposal after all claims. [E57]

The unsuccessful cases are also substantial. They include unauthorized start and proceeds withdrawal, unfunded or repeated start, zero bids, contributions before opening or after closure, early or repeated finalization, claims without entitlement, duplicate claims and duplicate withdrawals. Recipient rejection is tested for both refunds and proceeds. The refund test verifies that a failed payment preserves credit and that withdrawal to another recipient succeeds. These assertions are designed to check rollback and accounting consistency rather than only the presence of an error. [E57]

Access control is tested for the current owner in ordinary start and withdrawal scenarios. Token tests reject burning another holder's balance without an allowance and confirm that no mint or owner entry point appears in the token interface. These cases do not fully cover auction ownership transfer or renunciation, arbitrary external token implementations or every inherited ERC20 operation. Those are boundaries of the existing strategy, not automatically proven defects. [E54, E57]

Input and timing tests include zero supply, zero token address, zero reserve, equal prices, a sale worth less than one wei, reserve-price flooring and exact deadline behavior. A small-price case ensures clearing is not dated before the commitment that funded it. However, testing these selected edges does not cover the extreme starting-capacity candidate P04 or the frontend's negative amount path C03. [E52, E54, E57]

## Regression, adversarial and property testing

The strongest remediation evidence is the test-before-fix chain for H01–H04. Commit `35253ce` introduced regressions for crowd-out, time-clearing reads, deadline status and issuer proceeds. Archived outputs record four failures before `20e24b1` and four passes after the changes. The matching source revisions support a correction account, while the absence of a new EVM replay limits this audit to historical execution evidence. [E12, E49]

Reentrancy validation includes a deliberately insecure control. The same attacker is directed at a fixture that transfers before clearing credit and at the production auction. The tests expect the fixture to lose honest bidders' ETH, while the production auction pays only the attacker's own refund. This is more informative than observing a failed attack without a positive control. It still covers a particular refund attack and does not establish security against every possible callback. The vulnerable fixture must not be reported as a production exploit. [E14, E55, E57]

The fuzz suite checks monotonic prices, uniform/conserving settlement and the time-clearing price. The invariant handler generates contributions, time advances, finalization, claims and withdrawals. Its four properties address ETH backing, token conservation, demand bounded by supply and uniform claims. This broadens coverage beyond a few hand-written sequences. Its limits are also concrete. Economics are fixed, the actor set is bounded, and unsupported actions include ownership changes, forced ETH, token donations, final dust burning and claims by the rejecting receiver. Handler preconditions turn many ineligible actions into no-ops, so invalid-call behavior remains dependent on explicit scenario tests. [E21, E57, E62]

Historical mutation records provide further evidence of test sensitivity. Rounding the time-clearing price down causes six recorded failures. Replacing accepted proceeds with the raw ETH balance causes three. A separate planted loop makes the gas test fail. These are useful examples, but reusable mutation patches and complete replay metadata are missing. They do not establish a comprehensive mutation score or prove that every possible incorrect implementation would be detected. [E15, E58]

## Coverage, gas analysis and static checks

The archived coverage report contains 52 passing tests, comprising 45 Mocha cases and seven Solidity properties. It predates the added gas test. Both production contracts show 100% line and statement coverage in that record, while the overall totals are lower because of an uncovered mock line. Branch coverage is not established. Executing every line also cannot show that the specification itself was correct or that asynchronous UI behavior was exercised. [E13, E58]

The gas test measures a new bid, crossing bid, finalization, claim and issuer withdrawal after 1, 10, 50 and 100 earlier bidders. The saved measurements are identical across those crowd sizes. The planted-loop example increases claim gas from 163,417 to 410,719 and exceeds the one-percent tolerance. This supports the selected no-bidder-loop objective. It does not establish a universal gas bound for all storage states, tokens or recipients. [E38, E58]

Slither is configured to fail on Medium or High findings, with dependencies excluded and selected equality checks suppressed. The historical record reports 19 findings for the original auction, 14 for the revised auction and none for the token. Detector results require interpretation. For example, redundant writes before a revert do not by themselves demonstrate an exploitable refund path. Historical dependency-audit output likewise cannot establish current advisory status. [E16, E17, E55, E58]

GitHub Actions encodes compilation, coverage, type checking, frontend building and the demonstration script, alongside a separate Slither job. Pages publication does not explicitly depend on that validation job. These files show intended automation, but no current remote run was authenticated in this stage. [E26, E58]

## Browser validation and review practice

The development log describes headless Chrome checks with a mock wallet and a manual local MetaMask walkthrough. The recorded manual session switches from chain 56 to Hardhat Local, places bids, finalizes, claims tokens and withdraws proceeds. It led to observations about token import, theme selection and the visibility of the sell-out control. These are documented team activities rather than browser sessions reproduced by this audit. Complete automation drivers and receipt records are not retained in the inspected repository. [E33, E59]

No repeatable frontend test suite comparable to Playwright, Cypress or Vitest was found in the tracked test configuration. A type check can detect type inconsistencies and a build can detect compilation or bundling problems, but neither validates transaction timing, account-switch races or a refund label. The recorded successful allocation of an already accepted bid also does not test C01's misleading minimum for a pending crossing bid. [E51, E59, E62]

Review evidence must be described with the same care. In the edited prompts, our team requested plans, approved selected changes and requested teammate review. Later entries describe the main AI session checking subagent work and documentation claims. This supports a record of review activities, but not a claim that every change received independent human security review. Agent review and team review remain distinct. [E34, E40, E59]

## New execution during Stage 6

The local environment has Node v25.9.0 and npm 11.12.1, but no project dependencies. Hardhat resolution fails with `ERR_MODULE_NOT_FOUND`. Slither, solc, Forge, TypeScript and Vite are not on PATH. A targeted npm-cache query returned no matches for the requested tooling. No installation was attempted. [E60]

The frontend build command was executed and exited with code 1 because `tsc` was unavailable. It stopped before TypeScript compilation or Vite bundling. This is an environment limitation, not a newly demonstrated source compilation defect. Contract compilation, the 53 existing test definitions, coverage and static analysis were not executed, and are not reported as passing. [E60]

Two dependency-free audit runs completed successfully. The five source-level checks from Stage 5 reproduced C01–C05 within their stated limits. Four additional Node tests exercised display lifecycle boundaries, every integer second of price decay through twice the duration, monotonic estimates for an already accepted commitment in a fixed-demand scenario, and the mathematical overflow condition underlying P04. These tests import the actual math module or evaluate narrowly scoped source logic. They are not EVM or browser integration tests. [E61]

The outcomes do not close any finding. C01–C05 remain open, P01–P03 still require controlled integration tests, and P04 remains provisional because its arithmetic example has not been deployed against the locked Solidity toolchain. The exact commands, individual exit codes, source hashes and relevant output are saved under `../validation/stage6/`. [E61]

The principal remaining gap is validation across component boundaries. Priority should go to delayed bid execution, complete form parsing, rejected-receiver history, wallet failure recovery, account/chain races and event reorganisation behavior. Contract properties should also be extended only against explicit scope decisions for unusual tokens, donations and ownership changes. The existing strategy provides useful evidence, but its historical execution, restricted model and missing browser automation prevent a broader correctness claim. [E62]
