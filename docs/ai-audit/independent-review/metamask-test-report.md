# MetaMask Functional Test Report

Date: 2026-10-23 (Asia/Singapore).
Source snapshot: `2e2c2a524bd82a8202f4fadc967dc68a147e52e7`.

This is a standalone wallet integration test report, separate from the
[repository defect audit](../../../audit/2026-10-23/report.md). Passing these
functional tests does not close the audit's open findings.

## Environment

- Chrome Jeff profile, official MetaMask 13.53.0.
- Isolated local app: `http://127.0.0.1:5174/`.
- Transactions used only Hardhat chain 31337 and disposable test ETH.
- The user completed password and wallet setup. No private keys were requested or imported.
- Testing ran from an isolated git archive in `/private/tmp/dutchpoint-metamask-20261023/repo`.
- Contract duration remained exactly 1,200 seconds; local time advancement exercised the deadline.

## Results

| Scenario | Observed Result |
| --- | --- |
| Reject connection | App displayed "You rejected the request in your wallet." |
| Connect and add local network | Account displayed; wrong-network warning on Ethereum Mainnet; added localhost RPC and switched to chain 31337 |
| Refresh | Wallet connection and on-chain commitment history restored |
| Reject bid | Useful rejection message; no commitment recorded |
| Repeat contributions | Approved 1 ETH and 0.5 ETH; cumulative commitment 1.5 ETH, one participant |
| Crossing bid | Submitted 20 ETH; 17.575 ETH accepted, 2.425 ETH automatically returned |
| Early clearing | Price locked at 0.019075 ETH/GVRA; bids closed, claims waited for scheduled endpoint |
| Sold-out settlement | Finalized, claimed 1,000 GVRA, imported GVRA into MetaMask, withdrew 19.075 ETH issuer proceeds |
| Completed controls | Claimed state replaced claim control; proceeds-withdrawn state replaced withdrawal control |
| Network change | Switching the site's wallet network to Ethereum displayed an unsupported-network warning; switching back restored the position |
| Undersubscribed settlement | Second deployment accepted 1 ETH; finalization at the 0.005 ETH/GVRA reserve allocated 200 GVRA |
| Unsold burn and later claim | Burned 800 unsold GVRA; preserved and subsequently claimed the owed 200 GVRA |

## On-Chain Verification

**Sold-out sale:** seven successful MetaMask transactions. The verification script
asserted the 2.425 ETH surplus refund, token supply and claim totals, zero refund
liabilities, and zero final auction ETH after issuer withdrawal. The wallet's
final balance equalled its initial 200 test ETH minus those transactions' gas.

- [Transaction receipts and assertions](evidence/sold-out-onchain-evidence.json)
- [Verification script](evidence/verify-wallet-test.mjs)

**Undersubscribed sale:** four successful MetaMask transactions. Verification
asserted 200 GVRA sold and claimed, 800 burned, remaining token supply of 200,
zero auction token inventory, and 1 ETH still held as unwithdrawn issuer proceeds.

- [Transaction receipts and assertions](evidence/reserve-onchain-evidence.json)
- [Verification script](evidence/verify-reserve-test.mjs)

Verification scripts were run in the isolated test copy with its generated ABIs
and deployment metadata. They require the same running local chain state.

## Screenshots

- [Connection rejection](evidence/01-connection-rejected.jpg)
- [Bid rejection](evidence/02-bid-rejected.jpg)
- [Sell-out and surplus refund](evidence/03-sold-out-refund.jpg)
- [Claimed settlement and issuer withdrawal](evidence/04-settlement-claimed.jpg)
- [Reserve settlement, burn and successful claim](evidence/05-reserve-burn-claim.jpg)

## Limitations

Pre-mining quote amounts changed while MetaMask approval was open; these are not
guaranteed transaction outcomes. This does not resolve the separate quote finding.
Local clock advancement needed a page refresh to immediately display eligibility
in this run; that alone does not establish a persistent polling defect.

Not exercised through MetaMask: switching between two distinct accounts,
locked-wallet recovery, pending-transaction reload, rejecting-receiver refund-credit
recovery, and a reentrancy attacker. The latter security cases were covered by
earlier contract tests, not by this wallet session. No additional account keys
were generated, and no Sepolia or mainnet transactions were sent.

The test session made no application-code, contract, dependency or source-deployment
metadata changes, commits or pushes. This report and its evidence were subsequently
added as documentation at the user's request. This is functional test evidence,
not a claim that the dApp is defect-free or production-audited.
