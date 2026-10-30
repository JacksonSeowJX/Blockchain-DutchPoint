# Independent Reviews

Two team members reviewed the project independently, each with an AI tool of their own, and their work is
kept here unchanged. Alfred's review (of `c36cb0c`, 22 October) is [below](#alfred-ai-assisted-evidence-review-22-october-snapshot).

## Sanjeev: Codex audit, re-checks and MetaMask test (23 October)

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

### What happened to each finding

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

## Alfred: AI-assisted evidence review (22 October snapshot)

Alfred Fong Wei Hao used a single AI agent, in eight stages, to review the repository at `c36cb0c`
(22 October), before Sanjeev's review and the fixes that followed. His folder (`ai_audit_report/` at the root
of his copy) is in [`alfred/`](alfred/AI_Audit_Report.md), unchanged:

| File | What it holds |
| --- | --- |
| [`AI_Audit_Report.md`](alfred/AI_Audit_Report.md) (and `AI_Audit_Report.docx`) | His report: eight sections on what the repository's records can and cannot prove, fifteen findings (H01-H06, C01-C05, P01-P04), and appendices mapping each claim to its evidence |
| [`audit_findings.md`](alfred/audit_findings.md), [`audit_evidence.md`](alfred/audit_evidence.md) | The finding register, including concerns he examined and rejected as false positives, and the evidence register (E01-E64) |
| [`diagrams/`](alfred/diagrams/) | Four architecture figures and their Mermaid sources |
| [`validation/`](alfred/validation/) | His checks of the frontend logic and their logs. He could not install the project in his environment, so these are Node checks of extracted logic, not the project's test suite |
| [`questions_for_team.md`](alfred/questions_for_team.md), [`audit_progress.md`](alfred/audit_progress.md), [`sections/`](alfred/sections/) | Open questions for the team, his stage-by-stage progress log, and the section drafts |

His scripts assume their original location (`ai_audit_report/validation/` at the repository root) and the
code of `c36cb0c`, so they record what he ran rather than something to re-run here.

Every one of his fifteen items was checked against the current code; the full verdicts are in the
[audit report](../report.md#second-independent-review-alfred). In short:

| His items | Outcome |
| --- | --- |
| H01-H06 | Already fixed before his review (our F1-F4 and two GitHub Pages fixes) |
| C01, C03, C04 | The same defects Sanjeev found (A1, A4, A5), found independently; fixed |
| C05, P01, P03 | Fixed by the A2/A3 changes (`fe44d91`) |
| C02, P04 | New: fixed as B1 and B2, each with a test that failed first ([evidence 13](../evidence/13-alfred-review-fixes.txt)) |
| P02 | Recorded as a known limitation |

He also caught two errors in our documents (the prompt log called verbatim; `ReentrancyGuard` claimed on
every state-changing function), both corrected. Most of his questions for the team concern evidence that did
not exist at his snapshot, such as the Sepolia deployment, which later work supplied.

