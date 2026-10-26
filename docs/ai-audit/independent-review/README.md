# Independent Review (Codex, run by Sanjeev)

On 23 October 2026 a team member (Sanjeev) independently reviewed `main` at commit `2e2c2a5` with OpenAI
Codex. This was the third AI pass over the code, after Codex (first build) and Claude Code (review and
remediation); ChatGPT had written the plan before any code. Everything he produced is committed
**unchanged**, in the folder layout of his own copy of the repository, so every link in his reports works:

| Report | What it covers |
| --- | --- |
| [`audit/2026-10-23/report.md`](audit/2026-10-23/report.md) | A defect audit: six confirmed findings (A1-A5, A7), all in the frontend; contract probes across 36 deterministic scenarios; a fresh Slither run including suppressed findings; and a note on the invariant tests' domain. Beside it are the frontend reproduction script, the contract probes and the Slither output |
| [`testing/2026-10-23/results.md`](testing/2026-10-23/results.md) | A check of the 23 October changes, following the friends' testing guide: a fresh run of the full test suite, gas test and demo; a read-only check of the finished Sepolia auction against the chain; and screenshots of the live and local site. Its one finding is A1 |
| [`testing/metamask/2026-10-23/report.md`](testing/metamask/2026-10-23/report.md) | A wallet integration test with the real MetaMask extension: rejected connection and bid, network switching, repeat bids, a sell-out with surplus refund, and an undersubscribed sale with burn and late claim. All scenarios behaved as expected. Five screenshots and two scripts that check each wallet transaction against the chain |

**About the scripts.** They were run against `2e2c2a5` from his original location (`docs/audit/...` and
`docs/testing/...`), and their relative paths assume it. They record what he ran. The frontend and quote
reproductions target code that has since been fixed, so re-running them now would show the fixes rather than
the defects, and the verification scripts read the chain state of his own sessions.

## What happened to each finding

Every finding was checked independently before anything was changed (A1 and A4 by recomputing the
report's numbers, the others by reading the code). Each was then encoded as a frontend regression test that
fails on the audited code and passes after the fix. See
[`../evidence/11-independent-codex-review.txt`](../evidence/11-independent-codex-review.txt).

| Finding | Verdict | Fix |
| --- | --- | --- |
| A1: the unmined bid quote promised a minimum the auction does not guarantee | Confirmed (88.89 GVRA quoted, 69.77 claimed) | First the quote was relabelled *If fully accepted, at least* (`fe44d91`). Then, as the report recommended, the minimum was enforced on-chain: `contributeWithMinimum(minTokens)` reverts instead of filling below it, and the dApp sends every bid except a sell-out with one (`5b7be42`, [evidence 12](../evidence/12-bid-protection.txt)). The quote now reads *This bid buys at least* |
| A2: a read still in flight when the network changes corrupted the new network's history and cursor | Confirmed | Each provider/deployment pair is a read context; outdated reads finish without touching state, and queued refreshes run the current context's read |
| A3: an older wallet response could restore the previous account | Confirmed | Wallet syncs are numbered and only the newest may update state. Transactions also check the signer and network just before sending |
| A4: negative amounts enabled a "Bid -1 ETH" button | Confirmed | Amounts must be above 0 and fit in uint256, with a field-level message |
| A5: the history said "Refunded" for a surplus that was only credited | Confirmed | The history reads `RefundCredited` events; the *Surplus* column shows *returned* or *held* |
| A7: the dApp could only withdraw a held refund to the wallet that had rejected it | Confirmed | *Send refund to* field (default: the connected account), validated, passed to `withdrawRefundTo` |
| Invariant domain: `EthIsFullyBacked` asserted an exact balance that forced ETH could break | Agreed | Now `balance >= owed` and exactly `owed + forced ETH`; the handler also forces ETH in and lets holders burn their own GVRA |

The MetaMask report also notes that after the local time-skip one view needed a page refresh to show
*Ready to finalize*. The report itself says this did not establish a defect. It is recorded here as an
observation to re-check while rehearsing the demo.
