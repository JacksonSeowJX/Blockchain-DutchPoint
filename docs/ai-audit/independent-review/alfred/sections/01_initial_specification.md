# 1. Initial Specification & System Scope

Our application addresses the problem of distributing a fixed token supply through a transparent sale with a common settlement price. Instead of treating each contribution as an immediate purchase at the displayed price, the intended auction collects ETH commitments while the price decreases. A successful participant then receives tokens according to the final allocation rule and clearing price. The educational objective is to demonstrate how smart contracts coordinate a token sale, account for participant funds and enforce settlement without an application backend. This objective is documented in the initial specification at commit `0a75a78`. It does not establish that the mechanism eliminates transaction-ordering advantages or guarantees fairness under every allocation rule. [E02, E29]

The project is now named DutchPoint and its token is Gavora, with ticker GVRA. The earliest committed implementation used FairLaunch and `LaunchToken`. The preserved ChatGPT planning output already uses DutchPoint and Gavora, although it suggests different tickers. We therefore distinguish the planning record, the first committed specification and subsequent changes. The existing report describes the team's discussion before AI use retrospectively. There are no contemporaneous planning notes or original conversation exports that independently establish the sequence of those discussions. [E09, E29, E31]

The following account reconstructs the original scope from repository evidence. Requirements attributed to the course brief are confirmed as statements in the project documents, but cannot yet be checked against the brief itself because the assignment PDFs are absent. Design choices recorded as assumptions are not treated as requirements approved by the teaching team. [E03]

The intended users were the token issuer and auction participants. The issuer would deploy and fund the auction, start the sale and withdraw the proceeds permitted by its accounting rules. Participants would connect a wallet, commit ETH, inspect their position, claim tokens and withdraw any refund. Assessors were also intended users of the local setup and demonstration instructions. Our team's documented project objective was a complete, locally runnable Ethereum dApp that illustrated the auction lifecycle and its security considerations. [E29, E30]

The original functional requirements were recorded as follows.

| Requirement area | Original intended behavior |
| --- | --- |
| Token and inventory | Use an ERC20 token with a fixed initial mint and support permanent burning. Keep the token logic separate from the auction logic and fund the auction before starting it |
| Auction duration and price | Use a 1,200-second window and a deterministic linear price decrease from a starting price to a reserve floor |
| Contributions | Accept ETH commitments through a function call or plain ETH transfer while the auction is active. Aggregate repeated contributions by address |
| Clearing | Identify when committed ETH can purchase the available supply, including when falling prices cause clearing without a new contribution |
| Settlement | Use one final price, calculate token entitlements and surplus ETH, and prevent duplicate claims or withdrawals |
| Inventory disposal | Burn unsold tokens after an undersubscribed auction. Preserve unclaimed entitlements and burn rounding dust only when all participants have settled |
| Demonstration | Provide deployment instructions, a frontend, tests and a local walkthrough covering successful and undersubscribed sales, refunds and reentrancy resistance |

These requirements appear in `docs/spec.md` and `docs/architecture.md` at `0a75a78`. The documents also record non-functional intentions. ETH transfers should follow checks-effects-interactions and use reentrancy protection. Settlement should avoid loops over all bidders so that an individual operation does not depend on processing the entire participant set. Integer arithmetic should preserve token and ETH accounting, and browser estimates should not determine the authoritative outcome. A reproducible local setup should require neither real funds nor paid services. These were design objectives, not claims that the first implementation satisfied every property. [E29, E30]

The initial scope covered one auction per deployment. Auction factories, multiple concurrent auctions, upgradeable proxies, oracles, secondary trading, cross-chain features and a backend database were excluded. The initial assumptions also excluded allowlists, KYC and anti-sybil controls. The application was intended as a local educational dashboard rather than a production token-launch service. [E29]

The planned architecture separated responsibilities into three parts. `LaunchToken` would implement the ERC20 supply and burning behavior using OpenZeppelin. `DutchAuction` would hold the sale inventory and maintain commitments, clearing information, settlement receipts, refund credits and issuer proceeds. A React and Vite frontend would communicate directly with the contracts through ethers and a browser wallet. Hardhat scripts and TypeScript tests would support deployment, ABI export and deterministic demonstrations. The initial token inherited Ownable even though it exposed no later mint function. Removal of that role belongs to the later GavoraToken revision. [E30, E05]

Some auction policies were unresolved in the original requirements. The first committed specification allowed economic clearing before the deadline but delayed settlement until the full 20 minutes had elapsed. It interpreted automatic refund processing as automatic calculation of a credit followed by a separate user-triggered ETH withdrawal. Both interpretations were explicitly recorded as awaiting TA approval. [E29]

The crossing-bid rule also differed between the planning output and the first implementation. The ChatGPT plan proposed allocating only the remaining tokens to the final bidder and returning the excess ETH. The first committed specification instead accepted the entire contribution as a budget and allocated a cleared sale pro-rata across all commitments. It calculated each participant's accepted cost at the common final price and treated the remainder as a refund. Uniform pricing was therefore an original intention, but protecting earlier bidders from dilution by an oversized final bid was not achieved by that initial policy. Arrival-order filling and immediate surplus refunds were implemented later in `20e24b1`. [E12, E29, E31]

The expected transaction sequence reflected this original settlement model.

| Transaction or operation | Expected state change in the initial design |
| --- | --- |
| Deploy and fund | Mint the initial token supply, create the auction with its parameters and transfer the sale inventory into it |
| Start | Verify funding and record the start time, establishing the scheduled closing time |
| Contribute | Increase the caller's commitment and total committed ETH. Register a new participant where needed and record clearing if the threshold is reached |
| Finalize after the deadline | Record the clearing outcome and final price, calculate global tokens sold and burn provably unsold inventory |
| Settle and claim | Record the participant's allocation, accepted cost and refund credit, transfer tokens and accrue that participant's accepted cost as issuer proceeds |
| Withdraw refund or proceeds | Reduce the corresponding available liability or increase withdrawn accounting and transfer ETH to the selected recipient |
| Burn remaining dust | Burn residual token units after every registered participant has settled |

Reading the price or allowing time to pass does not itself submit a transaction or store a new state. The initial design intended to reconstruct time-based clearing when a transaction processed it. The later audit identified that the original read functions did not consistently reflect this economic state. Likewise, issuer revenue originally accrued through individual participant settlement, rather than becoming fully available at finalization. These distinctions are necessary when describing the initial architecture. [E23, E29, E30]

The planned frontend included wallet and network status, token details, a descending-price chart, a countdown, total committed ETH and an ETH contribution form. It would distinguish provisional estimates from finalized entitlements and provide controls for finalization, claims, refunds, proceeds and dust burning. Transaction status and settlement receipts were intended to make the outcome understandable to participants. [E29]

Wallet connectivity was required to identify the user's address and network and to authorize transactions through MetaMask or a compatible browser wallet. The initial architecture specified ethers v6 and MetaMask, while the specification required a wrong-network state. The browser was expected to read contract state and display estimates without replacing on-chain accounting. Later additions such as the token watchAsset button and revised network-switching states should not be presented as original requirements. [E06, E29, E30]

The development log preserves a summary of the instructions supplied to the initial coding agent. They asked it to read the assignment documents, inspect workspace instructions, establish the specification and auction mathematics before implementation, and use Solidity, OpenZeppelin, Hardhat, React, Vite, TypeScript, ethers and MetaMask. The requested deliverables included contracts, frontend code, tests, scripts, documentation and audit evidence, without mainnet deployment or paid services. This is a recorded summary rather than an authenticated verbatim prompt. The single initial commit contains both documentation and implementation, so it cannot independently prove their order of creation. [E09, E32]

Later work changed or extended this scope. The allocation and refund policy changed in `20e24b1`, and the token was renamed and its unused ownership role removed in `1ba8883`. Solidity fuzz and invariant tests, a vulnerable reentrancy baseline, CI and operational Slither checks strengthened validation. Optional Sepolia deployment tooling and GitHub Pages hosting extended delivery beyond the initial local setup. The rebuilt dashboard added event history and a demand meter, followed by theme selection, token registration in the wallet, sale details and FAQ features. Some additions, including the vulnerable baseline, realized ideas already present in the planning output. Their later implementation should not be confused with a wholly new objective. [E14–E16, E31]

Source locators and claim classifications are retained in `../audit_evidence.md`, particularly E29–E32. The missing primary brief, original prompt exports, pre-AI chronology and TA decisions remain open under Q01, Q02, Q04, Q06 and Q18.
