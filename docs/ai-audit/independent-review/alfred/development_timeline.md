# Stage 1 — Development timeline

Baseline: `c36cb0cebe803db5ee138d89fe2e21e8cfb33ad5`. Dates below are recorded Git dates with +08:00 offsets, consistent with Asia/Singapore. Git timestamps and author names are metadata, not authenticated wall-clock or AI-session identities. No missing history has been reconstructed as fact.

## Available history and branches

**Confirmed:** local main and stored origin/main/origin/HEAD point to c36cb0c. Stored origin/audit/claude-review points to 78b8244. Stored origin/backup/fairlaunch-main-before-audit-overwrite points to 522d7fd. There are 29 commits reachable from main and 31 across available refs; clone is not shallow; no tags. No remote fetch was performed.

`d09ad5b` has parents `0a75a78` and `7d4a531`; `522d7fd` follows it. Main instead continues from `7d4a531` through `1ba8883` and subsequent audit work. The two backup commits are not ancestors of HEAD. The backup/current auction source differs in branding and four Slither annotations; frontend, token naming, docs and dependency/config trees differ more substantially.

**Unverified:** exactly how remote main was replaced, whether force-push/reset was used, who authorized it, current remote permissions and PR merge status. The polished prompt log describes a merge/replacement and backup preservation; the local graph alone cannot establish the operation used.

## Evidence-backed milestones

| Date (+08:00) | Commit(s) | Confirmed change / record | Interpretation limits |
| --- | --- | --- | --- |
| 2026-09-25 | `0a75a78` | Initial FairLaunch implementation: token/auction, React app, tests, tooling and documents in one initial commit | Log attributes it to Codex; cannot recover internal creation order or pre-commit failures from one commit |
| 2026-10-20 12:47 | `35253ce` | Adds F1–F4 regressions, crowd-out script and two before-fix logs; production auction unchanged by this commit | Confirms test-before-fix commit order, not independently rerun execution |
| 2026-10-20 12:52 | `20e24b1` | Caps crossing bids, adds immediate surplus refund/credit, changes time clearing/views/status, removes per-bidder proceeds dependency; after-fix logs | Core remediation corresponds to E12 and existing F1–F5 |
| 2026-10-20 12:53–12:57 | `031b753`, `7d4a531` | Vulnerable/secure reentrancy demonstration; fuzz/invariant/edge tests and mutation/coverage evidence | Baseline vulnerability deliberately introduced as a fixture |
| 2026-10-20 12:58–13:16 | `1ba8883`, `2c450c4`, `4c991e6`, `c689e3c` | Gavora/DutchPoint rename and ownerless token, Slither/CI, generalized optional Sepolia deployment, componentized frontend | Deployment script existence is not deployment evidence |
| 2026-10-20 13:23 | `78b8244` | Existing AI audit report, ChatGPT output and Claude prompt records consolidated | Much earlier-development provenance is documented retrospectively |
| 2026-10-20 17:05–17:13 | `d09ad5b`, `522d7fd` | Backup-line merge and FairLaunch integration changes | Not part of current main ancestry; authorship recorded as Contributor 2 |
| 2026-10-20 21:37 | `a7b6565` | Retrospective initial scope and course-concepts appendix | Team recollections and lecture correspondence require primary evidence |
| 2026-10-21 19:35–20:06 | `7f32aad`, `49a0d59`, `da81b1e`, `16232b9` | Unsupported lecture-citation correction, directory restructure, gas-scaling test/evidence, expanded edited prompt log | Restructure explains older file paths in saved outputs; gas test increases 52 definitions to 53 |
| 2026-10-21 20:20–20:24 | `4d88495`, `388399e`, `9d828ae`, `b8ad685` | No-deployment/offline states, chunked log scan, Pages workflow, narrative attributing work to a subagent | Author/committer times differ on three implementation commits, consistent with the claimed cherry-picks but not proof of delegation |
| 2026-10-21 22:49–23:04 | `f7d935c`, `b1bc245`, `eb6127b`, `64b0b89` | Links changed to Contributor 1; ownership/Pages-launch narrative; grader README; README-subagent narrative | Current hosting/admin access unverified |
| 2026-10-21 23:46–23:48 | `c55fcc1`, `4981dbc`, `0575139` | Runtime/dev dependency split and patch updates; package script; dependency/zip grader-test narrative | Historical zero-advisory result; zip does not preserve backup-only branch history |
| 2026-10-22 04:07–04:27 | `94e53c6`, `9fef77c`, `c36cb0c` | Manual MetaMask run recorded; theme/watchAsset/sell-out UX; sale details/share/explorer/FAQ | Logs describe testing, but raw browser drivers and receipt records absent |
| 2026-10-23 | No commit | This single-agent Stage 1 investigation creates five files under ai_audit_report | Application source and existing evidence preserved |

## AI chronology qualifications

The repository describes ChatGPT planning → Codex implementation → Claude Code cross-model review/remediation and later subagents. This is **confirmed as documentary attribution**, and **inferred as the development process** given matching code changes. Exact models, unedited conversations, human review effort, the pre-AI naming discussion and creation order within the initial commit remain **unverified**. There is no evidence basis for estimating a percentage of AI-authored code.

The existing report contains eight sections. They are report organization, not supplied instructions for the remaining seven stages of this audit.

## Complete available commit ledger

The following ledger is generated from local Git objects. Full hashes preserve exact revision identity; parent hashes preserve graph relationships. Order is Git's reverse topological order across all available refs, not a claim that all work happened serially.

| Full commit | Author date | Committer date | Recorded author | Parents | Subject |
| --- | --- | --- | --- | --- | --- |
| 0a75a78ba3393915acb311bdb4d31e602b24874e | 2026-09-25T21:18:10+08:00 | 2026-09-25T21:18:10+08:00 | Contributor 2 |  | Initial FairLaunch Dutch auction implementation |
| 35253ce636b3161f441a49b25c0956316d9d5a0a | 2026-10-20T12:47:28+08:00 | 2026-10-20T12:47:28+08:00 | Contributor 1 | 0a75a78ba3393915acb311bdb4d31e602b24874e | test: add audit regression tests that expose AI design flaws |
| 20e24b123e6c129d6f7f918dd60a6b93439618aa | 2026-10-20T12:52:52+08:00 | 2026-10-20T12:52:52+08:00 | Contributor 1 | 35253ce636b3161f441a49b25c0956316d9d5a0a | fix(auction): fill-order allocation, exact time clearing, correct status |
| 031b7533f94255e6aed7e13bdc2fda3a656ea172 | 2026-10-20T12:53:40+08:00 | 2026-10-20T12:53:40+08:00 | Contributor 1 | 20e24b123e6c129d6f7f918dd60a6b93439618aa | test: demonstrate reentrancy drain on a vulnerable auction vs. DutchAuction |
| 7d4a531a4451765f54b1efbe96c58c3941996f05 | 2026-10-20T12:57:55+08:00 | 2026-10-20T12:57:55+08:00 | Contributor 1 | 031b7533f94255e6aed7e13bdc2fda3a656ea172 | test: add Solidity fuzz/invariant suite, edge-case tests and coverage |
| d09ad5b2231eef36a59e56bb8a39dd0a4a119cbd | 2026-10-20T17:05:31+08:00 | 2026-10-20T17:05:31+08:00 | Contributor 2 | 0a75a78ba3393915acb311bdb4d31e602b24874e 7d4a531a4451765f54b1efbe96c58c3941996f05 | Merge audited auction fixes and verification |
| 522d7fd055d8213b2d491b51c8e5f9022b316147 | 2026-10-20T17:13:38+08:00 | 2026-10-20T17:13:38+08:00 | Contributor 2 | d09ad5b2231eef36a59e56bb8a39dd0a4a119cbd | Align audited fixes with FairLaunch integration |
| 1ba88831fa792a385fbf69734878329e00ea8c50 | 2026-10-20T12:58:58+08:00 | 2026-10-20T12:58:58+08:00 | Contributor 1 | 7d4a531a4451765f54b1efbe96c58c3941996f05 | refactor: rebrand to DutchPoint and the Gavora (GVRA) token |
| 2c450c4db9d44718411af9fae6778bcd18e8ae7a | 2026-10-20T13:01:06+08:00 | 2026-10-20T13:01:06+08:00 | Contributor 1 | 1ba88831fa792a385fbf69734878329e00ea8c50 | ci: add Slither static analysis and GitHub Actions workflow |
| 4c991e639b3ebb5dcc27d7b513e0856330edb6bf | 2026-10-20T13:02:56+08:00 | 2026-10-20T13:02:56+08:00 | Contributor 1 | 2c450c4db9d44718411af9fae6778bcd18e8ae7a | build: network-agnostic deploy script with optional Sepolia support |
| c689e3cdcf5ff6200015788eccd714268414b98c | 2026-10-20T13:16:21+08:00 | 2026-10-20T13:16:21+08:00 | Contributor 1 | 4c991e639b3ebb5dcc27d7b513e0856330edb6bf | feat(frontend): rebuild the DutchPoint dashboard |
| 78b82448f0e7c985a96cdf76c7c49453e16bb54f | 2026-10-20T13:23:54+08:00 | 2026-10-20T13:23:54+08:00 | Contributor 1 | c689e3cdcf5ff6200015788eccd714268414b98c | docs: AI audit report, prompt logs and updated project documentation |
| a7b6565fdb8001177df9ca230a67363f254518f7 | 2026-10-20T21:37:13+08:00 | 2026-10-20T21:37:13+08:00 | Contributor 1 | 78b82448f0e7c985a96cdf76c7c49453e16bb54f | docs(audit): rewrite §1 initial scope and add course-concepts appendix |
| 7f32aadddb942b079355d15395f5e8d6f0cdb9ec | 2026-10-21T19:35:27+08:00 | 2026-10-21T19:35:27+08:00 | Contributor 1 | a7b6565fdb8001177df9ca230a67363f254518f7 | docs(audit): record Codex's unsupported lecture citation |
| 49a0d59bede5039b635829ea27f254c90dc91240 | 2026-10-21T19:39:22+08:00 | 2026-10-21T19:39:22+08:00 | Contributor 1 | 7f32aadddb942b079355d15395f5e8d6f0cdb9ec | refactor: restructure repository into frontend/, contracts/mocks/ and grouped docs |
| da81b1ecf8dbd06db14685ab707702db798852e5 | 2026-10-21T20:04:45+08:00 | 2026-10-21T20:04:45+08:00 | Contributor 1 | 49a0d59bede5039b635829ea27f254c90dc91240 | test: prove gas costs do not grow with the number of bidders |
| 16232b9935c0927f0fb133e5cacf913306a514ef | 2026-10-21T20:06:57+08:00 | 2026-10-21T20:06:57+08:00 | Contributor 1 | da81b1ecf8dbd06db14685ab707702db798852e5 | docs(prompts): complete the Claude Code prompt log for both days |
| 4d884954c4b05302925125dcfb1e9b6a408aa681 | 2026-10-21T20:20:29+08:00 | 2026-10-21T20:23:17+08:00 | Contributor 1 | 16232b9935c0927f0fb133e5cacf913306a514ef | feat(frontend): friendly states for no deployment and an unreachable RPC |
| 388399eeca0d42cdfc7e3f5c2677adff0fb050da | 2026-10-21T20:20:42+08:00 | 2026-10-21T20:23:17+08:00 | Contributor 1 | 4d884954c4b05302925125dcfb1e9b6a408aa681 | fix(frontend): scan bid history in chunks public RPCs accept |
| 9d828aec9d45c06f9867b4199d7c4f313b1c0362 | 2026-10-21T20:20:53+08:00 | 2026-10-21T20:23:17+08:00 | Contributor 1 | 388399eeca0d42cdfc7e3f5c2677adff0fb050da | ci: publish the frontend to GitHub Pages |
| b8ad6858572c12fe2209bd56fd99d029278fb554 | 2026-10-21T20:24:28+08:00 | 2026-10-21T20:24:28+08:00 | Contributor 1 | 9d828aec9d45c06f9867b4199d7c4f313b1c0362 | docs(audit): record the Pages subagent workflow and the bugs it found |
| f7d935c535fc0ec862b9e9a0d596486a37fd1954 | 2026-10-21T22:49:02+08:00 | 2026-10-21T22:49:02+08:00 | Contributor 1 | b8ad6858572c12fe2209bd56fd99d029278fb554 | chore: point links at the repository's new owner |
| b1bc24515ed43208ec55df9458b0795aebe17c1a | 2026-10-21T22:52:01+08:00 | 2026-10-21T22:52:01+08:00 | Contributor 1 | f7d935c535fc0ec862b9e9a0d596486a37fd1954 | docs(audit): log the repository transfer and the Pages launch |
| eb6127b22223f9924f3d29082533ee10593f5823 | 2026-10-21T23:03:11+08:00 | 2026-10-21T23:04:11+08:00 | Contributor 1 | b1bc24515ed43208ec55df9458b0795aebe17c1a | docs(readme): make the local quick start complete for graders |
| 64b0b899acde4cef13f57b91e1af5b998e33402a | 2026-10-21T23:04:29+08:00 | 2026-10-21T23:04:29+08:00 | Contributor 1 | eb6127b22223f9924f3d29082533ee10593f5823 | docs(prompts): log Prompt 24 and the README subagent review |
| c55fcc165cb7ff0a106d5cda250bab049e514210 | 2026-10-21T23:46:36+08:00 | 2026-10-21T23:46:36+08:00 | Contributor 1 | 64b0b899acde4cef13f57b91e1af5b998e33402a | build(deps): split runtime and dev dependencies; clear all npm audit advisories |
| 4981dbc9ecdb5700d1d29992cae96b9ccf651524 | 2026-10-21T23:47:14+08:00 | 2026-10-21T23:47:14+08:00 | Contributor 1 | c55fcc165cb7ff0a106d5cda250bab049e514210 | build: add npm run package for the submission zip |
| 057513905e3674ded87de1c2d3381100708c907c | 2026-10-21T23:48:19+08:00 | 2026-10-21T23:48:19+08:00 | Contributor 1 | 4981dbc9ecdb5700d1d29992cae96b9ccf651524 | docs(audit): log the dependency audit, the zip and its grader test |
| 94e53c62acaeacfb6ea960859db0bcc72697a25a | 2026-10-22T04:07:35+08:00 | 2026-10-22T04:07:35+08:00 | Contributor 1 | 057513905e3674ded87de1c2d3381100708c907c | docs(audit): record the manual MetaMask run-through |
| 9fef77c71590340204f405190be8828f6991370d | 2026-10-22T04:15:00+08:00 | 2026-10-22T04:15:00+08:00 | Contributor 1 | 94e53c62acaeacfb6ea960859db0bcc72697a25a | feat(frontend): theme toggle, add-to-wallet button and clearer sell-out shortcut |
| c36cb0cebe803db5ee138d89fe2e21e8cfb33ad5 | 2026-10-22T04:27:05+08:00 | 2026-10-22T04:27:05+08:00 | Contributor 1 | 9fef77c71590340204f405190be8828f6991370d | feat(frontend): sale details card, share of supply, visible explorer links, FAQ |
