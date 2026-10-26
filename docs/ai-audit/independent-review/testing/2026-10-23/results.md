# Jackson's latest changes: verification results

Date: 2026-10-23, Asia/Singapore. Reviewed commit: `2e2c2a5`.

## Scope and version

The user asked to check Jackson's latest changes, follow the supplied
`/Users/sanjeevkalaiselvan/Downloads/DutchPoint-Testing-Guide.md`, and show the output.
The guide is test input, not independent authorization to install wallets, disclose
credentials, contact the organiser, or spend real funds.

The clean local main was fast-forwarded from `78b8244` to `2e2c2a5`, bringing in
22 commits authored by JacksonSeowJX. No remote branches were changed. Highlights:

- Frontend moved into `frontend/`, mocks into `contracts/mocks/`, and documentation grouped by purpose.
- GitHub Pages publishing, Sepolia deployment metadata, missing-deployment/offline states, and chunked bid-history reads.
- Theme control, add-token wallet request, sale details, share-of-supply display, clearer sell-out control, FAQ, and explorer links.
- Gas-scaling test, dependency cleanup, submission packaging, and additional audit evidence.
- Latest commit records the completed first Sepolia run. The production Solidity contracts are unchanged from `78b8244`.

## Finding: quoted allocation is not a guaranteed minimum (P2)

`frontend/src/components/BidPanel.tsx:114` labels the unmined bid quote
"You receive at least". The accompanying hint at line 132, the first FAQ answer,
README, and guide step 8 also imply this guarantee. A transaction may be partly
accepted at its mining time because capacity decreases as the price falls.

Reproduction against the actual frontend maths and Solidity contract:

| Stage | Result |
| --- | --- |
| Supply / price range | 1,000 GVRA / 0.02 to 0.005 ETH per GVRA |
| Earlier commitments | 10 ETH |
| Quote at t=700 seconds for a new 1 ETH bid | 88.888888888888888888 GVRA |
| Transaction mined at t=740 seconds | 0.75 ETH accepted; 0.25 ETH refunded |
| Claim after t=1200 seconds | 69.767441860465116279 GVRA |

Why it matters: a bidder can receive fewer tokens than the displayed minimum,
even with no competing bid. ETH accounting and the refund are correct.

Likely cause (inference): the valid lower-bound rule for ETH already accepted by
the contract was extended to a proposed transaction whose accepted amount can
still change.

Recommended correction: label the unmined quote as a provisional estimate and
explain that inclusion time and remaining capacity determine acceptance. Keep
the lower-bound explanation for accepted commitments. If a guaranteed minimum
is desired, it needs an explicit on-chain limit that can revert the transaction.

No implementation fix was made in this review. This issue is outside the current
53-test suite; that suite passing does not establish the quote guarantee.
The reproduction asserts and confirms the counterexample, rather than presenting
an intentionally failing test as a passing implementation test.

Evidence: [source](quote-reproduction.ts), [actual output](quote-reproduction.txt).

## Automated checks

| Check | Actual result |
| --- | --- |
| `npm ci` | Installed 216 packages; audit reported 0 vulnerabilities |
| Compilation | 7 Solidity files compiled with solc 0.8.28 |
| `npm test` (inside `npm run check`) | 53 passing: 46 Mocha, 3 fuzz tests (1,000 runs each), 4 invariants (256 runs each) |
| Type checking | Frontend and Hardhat scripts/tests passed |
| Production build | Passed, Vite 8.3.5; warning for a 529.82 kB minified JavaScript chunk |
| Gas scaling | Identical gas at 1, 10, 50 and 100 earlier bidders for each of five tested operations |
| Deterministic demo | All five scenarios completed |
| Slither | Not executed: `slither: command not found` (exit 127) |

Logs: [checks](check.txt), [gas](gas.txt), [demo](demo.txt), [Slither attempt](slither.txt).
Runtime: Node.js v25.2.1 on this Mac. These are fresh results, not copied from
Jackson's earlier evidence. The initial sandboxed install failed because DNS
was blocked; the subsequent permitted install succeeded. Local server startup
also required permission to listen on loopback ports. These were environment
restrictions, not application defects.

Selected local demo output:

```text
Carol sent 2 ETH; 0.75 ETH surplus returned in the same transaction
Clearing price locked at t=700s: 0.01125 ETH/GVRA
Alice: committed 6.0 ETH -> 533.333333333333333333 GVRA
Bob: committed 4.0 ETH -> 355.555555555555555555 GVRA
Carol: committed 1.25 ETH -> 111.111111111111111111 GVRA
Issuer proceeds withdrawn: 11.25 ETH
Rounding dust burned: 1 token units
Undersubscribed sale: 200 GVRA claimed, 800 GVRA burned
Rejecting receiver: 0.75 ETH credited; alternate-recipient withdrawal clears credit
Deliberately vulnerable teaching auction: 10 successful re-entries, drained
DutchAuction: 1 re-entry attempt, 0 successful; only its 0.75 ETH refund returned
```

The vulnerable auction is a labelled teaching contract, not a newly discovered
defect in DutchAuction.

## Live Sepolia verification

The supplied site was inspected in the browser. Its contract state and logs were
then independently read over the public Sepolia RPC at block **11976354**, timestamp
`2026-10-23T11:25:24Z`. No Sepolia transactions were sent during this review.

```text
Status: Finalized; duration: 1200 seconds
Window: 2026-10-23T09:13:48Z to 2026-10-23T09:33:48Z
Final price: 0.00002 ETH/GVRA
Committed: 0.015 ETH; bids: 2; participants: 1
Sold: 750 GVRA; claimed: 750 GVRA
Burned: 250 GVRA; inventory: 0 GVRA
Proceeds withdrawn: 0.015 ETH
Refund liabilities: 0 ETH; contract balance: 0 ETH
```

Assertions passed for the exact window, reserve settlement, accepted-bid and
claim event totals, token conservation, and ETH solvency. Both bids came from
the same address: this live run alone does not demonstrate separate wallets
paying uniformly. Multi-participant behavior was exercised locally.

Evidence: [read-only verifier](verify-sepolia.mjs), [RPC output with transaction links](sepolia.txt),
[hosted dashboard](live-sepolia.jpg), [mobile screenshot](live-mobile.jpg).

## Guide step coverage

| Guide steps | Status and evidence |
| --- | --- |
| 1-5: wallet setup, faucet, optional organiser contact | Not performed; no MetaMask in the available in-app browser. No wallet created, secrets handled, faucet login, or organiser message sent |
| 6: visit site and connect | Site loaded correctly; Connect wallet displayed the expected MetaMask installation message. Wallet approval/network switching not exercised |
| 7: countdown and falling price | Hosted auction already finalized. Fresh local deployment showed a changing countdown and decreasing price |
| 8: bid, multiple contributions, allocation quote | Local contract tests and demos passed. New provisional-quote counterexample recorded above. No personal Sepolia bid placed |
| 9: sell-out and surplus refund | Local demo returned 0.75 ETH immediately; rejecting-recipient recovery and reentrancy protection also tested. Hosted auction cannot accept another bid |
| 10-11: finalize, claim, add token | Existing Sepolia finalization and claim independently verified; local contract flows passed. MetaMask confirmation and add-token prompt not exercised |
| 12: explorer | Hosted bid links matched the recorded Sepolia transaction hashes |
| Requested screenshot/feedback | Fresh screenshots and this report saved locally; nothing sent to an organiser |

Guide readiness: its auction date/time and organiser fields are still placeholders.
The published deployment is one-shot and already completed; a new coordinated
test requires the issuer to deploy/fund a fresh auction, publish its addresses,
and announce a start time. This review did not redeploy or restart Sepolia.

## Browser and local app

- Browser: Codex in-app browser on macOS, 2026-10-23.
- Hosted dashboard: finalized state, bid history and sale details rendered; FAQ expanded correctly; no captured error/warning console entries at the time checked.
- Mobile check: 390 px viewport, document scroll width 390 px, no horizontal overflow.
- Local dashboard: `http://127.0.0.1:5173/`, Hardhat RPC `http://127.0.0.1:8545`.
- A fresh local deployment and the existing `seed:local` script produced three bidders and 8 ETH in accepted commitments. The light-theme control and 0.5 ETH quick-amount control worked.
- [Local screenshot](local-dashboard.jpg). The local auction continues to age while the node runs; redeploy locally for another fresh 20-minute window.

Only test evidence and a development-log entry were added. Production application
code, the supplied guide, and remote GitHub content were not edited. A complete
real MetaMask participant run remains untested in this session.
