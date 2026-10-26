# Independent Repository Audit

Date: 2026-10-23 (Asia/Singapore). Reviewer/tool: Codex.
Target: `2e2c2a524bd82a8202f4fadc967dc68a147e52e7` on main.
Remote was fetched again before this audit; no newer commit was present.

## Findings

Six confirmed findings: five P2 (moderate correctness/usability issues), one P3
(low-impact validation issue). None is a demonstrated theft, reentrancy drain,
or unauthorized token allocation in the production contracts. All are **open**;
no production fix or GitHub push was made during this audit.

| ID | Priority | Finding | Source |
| --- | --- | --- | --- |
| A2 | P2 | A stale network read corrupts the current network's history/cursor | `frontend/src/hooks/useAuction.ts:259`, reset at line 87, refresh at line 270 |
| A3 | P2 | An older wallet response restores the wrong selected account | `frontend/src/hooks/useWallet.ts:32`, state updates at lines 34-43 |
| A1 | P2 | The unmined bid quote promises a minimum the auction does not guarantee | `frontend/src/components/BidPanel.tsx:114`, hint at line 132 |
| A7 | P2 | The UI cannot redirect a refund away from a recipient that rejects ETH | `frontend/src/App.tsx:262` |
| A5 | P2 | History reports credited, unpaid surplus as already refunded | `frontend/src/components/BidHistory.tsx:33`, display at line 60 |
| A4 | P3 | Negative ETH input enables a bid and reaches the transaction handler | `frontend/src/components/BidPanel.tsx:72` |

A6 was an investigated candidate that was discarded; the numbering is retained
so the saved investigation output remains traceable.

### A2: Cross-network read completion corrupts bid history

**Trigger and impact.** Switch from Sepolia to a local deployment while the old
RPC is still reading. The effect clears `lastBidBlock`, but the old `load()` still
completes and writes a Sepolia block number into that shared ref. Old bid rows
also arrive after the reset. The new chain can then have correct summary figures
while showing old-chain bidders and never fetching its own history. The existing
queue repeats its captured old `load`, rather than forwarding the queued request
to the latest context.

**Reproduction.** Mount the actual hook with a delayed old-chain block read;
switch its provider/deployment props; release the old read; then refresh the new
chain. Actual result: snapshot block 100, old-chain bid retained, zero new-chain
log requests, old cursor 12,000,000. Refreshing cannot repair this cursor until
the new chain reaches it or another context change resets it.

**Likely cause (inference).** Serialization was designed for overlapping block
notifications on one provider, without invalidating asynchronous work when the
provider/deployment identity changes.

**Recommended fix.** Give each read context a generation ID, invalidate it during
cleanup, and guard every state/ref write after awaits. Keep history, block-time
cache and scan cursor scoped to chain and auction. Ensure a queued refresh uses
the current context, rather than the closure belonging to the previous one.

**Validation needed after fixing.** The same delayed-switch test must show only
new-chain rows and at least one log query against the new chain. Include switching
back, same-chain account changes, failed old reads, and component unmounts.

**Evidence:** [reproduction source](frontend-reproductions.mjs), [output](frontend-reproductions.txt).

### A3: Out-of-order wallet synchronization restores an old account

**Trigger and impact.** The initial `eth_accounts` request is slow. An
`accountsChanged` event starts another sync, which finishes with account B.
When the initial response for account A arrives later, it overwrites B. The
header and position can therefore show A while the wallet's signer is B.
This remains until another successful sync; the hook does not periodically
reconcile accounts. Contract access controls still apply, so this is not an
issuer-privilege bypass.

**Reproduction.** The actual hook first displayed
`0x2222222222222222222222222222222222222222`, then reverted to
`0x1111111111111111111111111111111111111111` when the deferred earlier response
completed. Both responses were valid for when their requests began.

**Likely cause (inference).** Request completion order was assumed to match
wallet-event order; there is no synchronization generation or stale-result check.

**Recommended fix.** Ignore older sync completions, handle request errors from
event-driven syncs, and clear/reconcile state on disconnect. Establish the account
and chain as a coherent context. Before submission, verify the signer and chain
still match the context in which the user initiated the action.

**Validation needed after fixing.** Delayed A must never overwrite B; also test
an empty account list, chain changes, denied requests and disconnect/reconnect.

**Evidence:** [source](frontend-reproductions.mjs), [output](frontend-reproductions.txt).

### A1: An unmined quote is an estimate, not a guaranteed minimum

**Trigger and impact.** Remaining ETH capacity decreases while wallet approval
or transaction inclusion is pending. A proposed bid can then be only partly
accepted, so its final allocation can be below the displayed "You receive at
least" amount. This wording also appears in the first FAQ answer, README and
supplied testing guide. The lower-bound rule remains valid for ETH already
accepted by the contract.

**Reproduction.** With 10 ETH already committed for 1,000 GVRA, a 1 ETH proposal
at t=700s quotes 88.888888888888888888 GVRA. At t=740s only 0.75 ETH fits; the
remaining 0.25 ETH is correctly refunded. The eventual claim is
69.767441860465116279 GVRA. No other competing transaction is needed.

**Likely cause (inference).** The rule for accepted commitments was applied to
unmined proposals without accounting for partial acceptance at inclusion time.

**Recommended fix.** Label the proposed bid quote as provisional and explain
inclusion-time acceptance/refunds. Keep the minimum label only for existing
accepted commitments. A genuine user-specified minimum would require an on-chain
limit that reverts if it cannot be met; wording alone cannot enforce it.

**Validation needed after fixing.** Test delayed inclusion and a competing
crossing bid; do not promise a minimum for a transaction that may be rejected.

**Evidence:** [Solidity/frontend reproduction](../../testing/2026-10-23/quote-reproduction.ts),
[actual output](../../testing/2026-10-23/quote-reproduction.txt).

### A7: Rejected-refund recovery always uses the failing recipient

**Trigger and impact.** A contract wallet rejects the automatic ETH refund and
receives a credit. The app's withdrawal action hardcodes
`auction.withdrawRefundTo(account!)`, which retries the rejecting address.
There is no recipient field. A capable wallet can recover through a manually
constructed contract call, but this required safety workflow cannot be completed
through the dApp. The funds remain backed and the credit is not lost.

**Reproduction.** A local rejecting receiver was credited 0.75 ETH. Withdrawal
to itself reverted and preserved the credit. Withdrawal to a different address
succeeded, including after the issuer withdrew its proceeds. The app offers only
the first of these paths.

**Likely cause (inference).** The interface implemented the normal EOA shortcut
without exposing the alternate-recipient capability the contract provides.

**Recommended fix.** Offer a validated refund-recipient address, defaulting to
the connected account, and pass the chosen address to `withdrawRefundTo`.

**Validation needed after fixing.** Use a rejecting contract wallet: self fails
without losing the credit, an alternate address succeeds, and a second withdrawal
is rejected. Real MetaMask EOA testing alone does not cover this contract-wallet case.

**Evidence:** [contract probes](contract-probes.ts), [output](contract-probes.txt),
and `frontend/src/App.tsx:261`.

### A5: Bid history confuses unpaid refund credits with paid refunds

**Trigger and impact.** The history column is labelled "Refunded", but calculates
every value as `ContributionReceived.amount - accepted`. It does not read
`SurplusRefunded`, `RefundCredited` or `RefundWithdrawn`. For a rejecting receiver,
it therefore says 0.75 ETH was refunded while the money is still held as a credit.
The connected position can simultaneously show "Refund waiting". This is a
misleading settlement receipt, not a contract-accounting loss.

**Reproduction.** The real rejecting-receiver transaction emitted
`RefundCredited` and no `SurplusRefunded` event. Rendering the history with those
contribution fields displayed "0.75 ETH" under "Refunded". Its data model has no
field that could distinguish the two outcomes.

**Likely cause (inference).** The history inferred successful payment from the
size of the surplus and did not incorporate the push-refund fallback state.

**Recommended fix.** Either label the column "Surplus" and show pending credit
separately, or derive paid/credited/withdrawn refund states from the refund events.
Use those events for a complete settlement receipt, too.

**Validation needed after fixing.** Cover a paid automatic refund, unpaid credit,
successful later withdrawal and page refresh with an outstanding credit.

**Evidence:** [component reproduction](frontend-reproductions.txt),
[actual credited-refund contract output](contract-probes.txt).

### A4: Negative commitment amounts are enabled

**Trigger and impact.** `parseEther("-1")` returns a negative bigint. There is no
parse error and `amount === 0n` does not reject it, so the connected form enables
"Bid -1 ETH" and passes `-1000000000000000000n` to the transaction callback.
Ethers cannot send negative transaction value, so this fails downstream. No
successful negative-value Ethereum transaction or loss of funds was demonstrated.

**Likely cause (inference).** Input validation treated a parseable ETH quantity
as a valid transaction value and checked only zero rather than nonpositive values.

**Recommended fix.** Reject `amount <= 0n` with a field-level message. Check
that the value fits uint256, and retain the existing decimal-precision rejection.

**Validation needed after fixing.** Negative, zero, empty, invalid, excessive
precision and out-of-range inputs must disable submission; a positive valid
amount must still work.

**Evidence:** [component reproduction source](frontend-reproductions.mjs),
[output](frontend-reproductions.txt).

## Contract and static-analysis results

The 53 existing tests, compiler, type checks and production build passed during
the immediately preceding verification of this same commit; those results are
in [the testing logs](../../testing/2026-10-23/check.txt). Production source and
the lockfile were not changed between that run and this audit.

Additional independent audit probes ran against actual locally deployed contracts:

- 36 deterministic scenarios vary fractional supplies and start/reserve prices
  from a few wei per token through 10 ETH per token. They exercise multiple bids,
  partial acceptance, reverse claim order, burns, and issuer withdrawals.
- For each scenario, finalization at the exact deadline was compared with
  finalization seven days later using an EVM snapshot/revert. Prices, sold amounts
  and burns were identical.
- Supply bounds and token/ETH accounting assertions passed in all 36 scenarios.
- A simulated unsolicited 1 ETH balance increment was not included in proceeds;
  participant claims still worked.
- A rejected push refund retained its credit after a failed self-withdrawal and
  remained withdrawable to another address after issuer withdrawal.

The existing deterministic demo also demonstrated the attack draining the
**deliberately vulnerable teaching contract**, and the same attack failing against
DutchAuction. This is not counted as a new production vulnerability.

### Fresh Slither 0.11.6 scan

Slither was installed in a temporary Python environment after the earlier testing
session found it unavailable. The scan used the already-downloaded native solc
0.8.28 and the repository's remappings/filter settings. The earlier unavailable
result is preserved as a record of that earlier attempt.

| Run | Findings and outcome |
| --- | --- |
| GavoraToken | 0 findings; exit 0 |
| DutchAuction with repository suppression comments | 14 findings: 1 Low reentrancy-benign, 10 Low timestamp, 3 Informational low-level calls; exit 0 with `--fail-medium` |
| DutchAuction with `--show-ignored-findings` | 18 findings including the 4 suppressed Medium incorrect-equality warnings; exit 255 with `--fail-medium`, as expected when showing those warnings |

The four equality warnings were reviewed explicitly. Three guard computed or
tracked values (`amount == 0` or `commitment == 0`); the other checks whether
post-claim token inventory is zero before burning it. None requires the contract's
ETH balance to equal a particular amount. Donating tokens adds burnable inventory
after everyone claims rather than blocking a withdrawal. They did not establish
an exploitable strict-balance condition.

The reentrancy-benign warning is about refund-credit writes after a failed call.
The externally reachable money-moving entry points use ReentrancyGuard, and a
reverting recipient cannot retain changes made in its reverted subcall. Existing
attack tests and the refund-solvency probes support the mitigation; it was not
silently treated as "no findings". Timestamp warnings concern the intentional
auction clock. The low-level calls are checked and use explicit failure handling.

Evidence: [auction scan](slither-auction.txt), [token scan](slither-token.txt),
[scan including suppressed findings](slither-all.txt), [structured results](slither-all.json),
[contract probe output](contract-probes.txt).

## Scope, remaining checks and rejected candidates

- Reviewed production Solidity, frontend hooks/components/maths, deployment and
  export scripts, dependency manifest, packaging script, CI/Pages configuration,
  test coverage, and the current specification/assumptions. The original Option 2
  brief and companion logistics were cross-checked against their local text
  extractions. No competing interpretation was silently treated as TA-approved.
- Frontend reproductions execute actual source bundled with esbuild and mounted
  with React test renderer. Network and EIP-1193 dependencies are deterministic
  fakes; these are unit-level reproductions, not claims of a real MetaMask run.
  React test renderer warns that it is deprecated. It was used only in the
  temporary audit harness, not added to project dependencies.
- No MetaMask login or private key was needed. Wallet extension prompts,
  disconnect behavior in a real extension, and full contract-wallet UI operation
  remain manual/integration-test gaps. MetaMask credentials were not requested.
- No mainnet or Sepolia transaction was sent. The one-shot Sepolia auction is
  already finalized; a new public participant test needs a fresh issuer deployment.
- No fund-loss, excess allocation, claim-order dependence or reentrancy exploit
  was reproduced in the production contracts. This statement is limited to the
  code review and tests recorded here; it is not a proof of absence of all defects.
- The exact-balance assertions in the original invariant suite describe its
  constrained handler: unsolicited ETH makes raw balance greater than tracked
  liabilities, and voluntary holder burns reduce totalSupply independently of
  auction burns. The added probes confirm this behavior; the core contract uses
  tracked proceeds and does not rely on those overly broad equalities. Expand the
  invariant handler and document the domains rather than calling donations a drain.
- Discarded A6: PositionPanel alone retains its add-token flag across a prop
  update, but App clears the snapshot and unmounts it on provider/deployment
  changes. The isolated component observation therefore did not establish a
  persistent full-app defect. It is explicitly excluded from the findings count.
- The guide's auction date/organiser placeholders and README's team TODO remain
  submission-readiness tasks, not smart-contract vulnerabilities.

## Reproduction and artifacts

Run from the repository root, after `npm ci`:

```sh
npm install --prefix /private/tmp/dutchpoint-audit-20261023 --no-save --package-lock=false react@19.3.0 react-test-renderer@19.3.0
node docs/audit/2026-10-23/frontend-reproductions.mjs
npx hardhat run docs/audit/2026-10-23/contract-probes.ts
npx hardhat run docs/testing/2026-10-23/quote-reproduction.ts
```

These reproductions assert that the counterexamples exist. Their successful exit
does **not** mean the application satisfies the corresponding requirements. After
fixes, replace them with regressions that assert the corrected behavior.

The Slither text logs contain the compiler invocation, including the local native
compiler path. To repeat the scan on another machine, install Slither 0.11.6 and solc
0.8.28 as documented in the README, then use `npm run slither`; additionally run
with `--show-ignored-findings` to review the suppressions.

All reproduction sources, stdout and Slither JSON are kept beside this report.
The application and contract sources are unchanged. Outstanding fixes should be
implemented and validated in a separate change so the pre-fix evidence survives.
