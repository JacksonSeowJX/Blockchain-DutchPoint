# Questions for the team

Updated at checkpoint S8-CONTENT-2026-10-23. Earlier questions are retained, with Q03 resolved by the user's recovery instructions specifying all eight stage names. No other team answer is assumed. All requested real-world facts remain **unverified** unless marked otherwise in the evidence register.

| ID / priority | Question / evidence requested | Why it matters and current basis |
| --- | --- | --- |
| Q01 / high | Supply the original project brief, current rubric, Development Project details and relevant lecture decks, with versions/dates. Which document supersedes Document.pdf or Document 2.pdf? | Only repository summaries are available; PDFs are absent/ignored (E03). Needed to verify requirements and course citations |
| Q02 / high | Has the TA approved arrival-order filling, closing bids early while delaying settlement until 20 minutes, and automatic surplus refunds with a pull fallback? Provide the decision or confirm no approval exists | `assumptions.md` explicitly says none approved. These choices define whether economic findings are requirement violations |
| Q03 / resolved | What are the intended names and objectives of audit Stages 4–8? | The user supplied Stage 4 architecture requirements and the eight-stage outline in the recovery request. Stages 5–8 are Problems Discovered & Vulnerability Analysis, Validation Process & Testing Strategy, Improvements & Lessons Learned, and Final Report Integration & Quality Review. Their names do not authorize starting them before the current-stage review |
| Q04 / high | Provide the original ChatGPT conversation/export and Codex session export, suitably redacted, with dates and model/tool settings | `prompts/README.md` retains TODOs. Planning output and a prompt summary cannot authenticate the full conversations |
| Q05 / high | Provide the original Claude Code transcript or relevant excerpts and session/model metadata. Which passages in the polished log were paraphrased? Can subagent briefs/results and memory rules be supplied? | Edited prompts are explicitly disclosed, but development log calls them verbatim (E09). Exact “Claude Opus 5.5” model claim is not independently authenticated |
| Q06 / high | Confirm each team member's responsibilities, manual contributions and review/approval work. What happened before the first AI prompt, and which decisions are remembered rather than contemporaneously recorded? | README/report roles TODO; pre-AI scope is openly retrospective. Git identities do not prove human contribution or understanding |
| Q07 / high | Explain the main/audit/backup branch integration and provide relevant PR discussion/review records. Were any backup-only changes intentionally excluded? | `d09ad5b` and `522d7fd` survive only on the backup ref; current main follows audit lineage. Graph proves divergence, not the claimed overwrite mechanism or consent |
| Q08 / medium | Provide CI run URLs/artifacts linked to exact commit hashes, including latest 53-test run and coverage, and browser-test driver/logs | Historical text reports passes; saved coverage log is a 52-test run. Screenshots/manual narration do not reproduce the browser test pipeline |
| Q09 / medium | Provide exact mutation patches/commands, random seeds and full outputs for M1–M3 if retained | Mutation summaries exist but reusable mutation automation was not found; needed for independent replay |
| Q10 / high | Has Sepolia deployment happened since the latest recorded session? If so provide public contract addresses, chain ID, deployment/funding/start transaction hashes, compiler profile and source-verification links | Tracked deployment map is empty and receipt files absent. Do not send private keys, recovery phrases or keystore contents |
| Q11 / medium | What compiler profile and supported Node/OS versions are intended for assessment and public deployment? Has a clean install of the Git/SSH forge-std lockfile dependency been tested in the assessor environment? | Production optimizer profile differs from default; npm scripts assume POSIX; local dependencies are absent |
| Q12 / medium | Is browser support limited to injected EOA wallets, or are smart-contract wallets part of acceptance criteria? Should refund history distinguish credit from payment, and can users choose refund recipients in the UI? | Contract has recipient fallback; UI sends refund to connected account and history conflates returned/credited surplus (E19) |
| Q13 / medium | Are ownership transfer/renunciation, forced ETH, token donations, long-lived unclaimed balances, extreme prices/supply and reorgs explicitly in scope? | Present invariants cover a narrower generated action space (E21); desired behavior must be established before deciding defects |
| Q14 / medium | Supply the exact source material supporting the corrected lecture mapping, one-slot timing bound and auction-fairness claims | Historical unsupported-citation correction exists, but the underlying lecture decks are unavailable (E25) |
| Q15 / medium | Is the current dependency-audit result retained as machine-readable output, and who reviewed advisory reachability? | E17 confirms historical text and lockfile changes, not current zero-advisory status or absence of build-time exposure |
| Q16 / medium | Should submission preserve the backup branch as well as main? How will these new Stage 1 documents enter the eventual submission without losing their checkpoint provenance? | `package.sh` clones a single branch and refuses uncommitted changes. No commit/package was authorized for Stage 1 (E27) |
| Q17 / low | What is the final demo-video location/version, and who performed the documented MetaMask run? Were the transaction receipts retained? | Demo script and run narrative exist; no final video or independently replayable receipt set found |

Pending validation leads, rather than questions that require speculation: reproduce E18 negative inputs, E19 refund-history labeling, E20 async/provider/reorg behavior; reassess E21 property scope and E22–E25 report wording. These belong to later stages after their scope is supplied. No application fixes are proposed or applied in this stage.

## Stage 2 clarification requests

These items concern statements omitted or qualified in the section drafts. They do not prevent completion of the evidence-based drafts.

| ID / priority | Question / evidence requested | Effect on Sections 1 and 2 |
| --- | --- | --- |
| Q18 / high | When was the preserved ChatGPT plan created, and was it supplied to Codex before the initial implementation? Which initial rules came from team decisions and which were selected by the agent? Please distinguish recollection from dated records | The plan's remaining-supply rule differs from the first committed pro-rata specification. Section 1 does not assume a single consistent original policy or independently confirmed pre-AI chronology |
| Q19 / high | Which members reviewed the allocation change, security changes and final frontend, and what review actions did they actually perform? Are comments, approvals or checklists retained? | Extends Q06–Q07. Section 2 reports recorded decisions but does not claim that all members reviewed all code or assign module ownership. Agent review of subagent output is identified separately |
| Q20 / low | Were development time, AI-generated contributions or manual corrections measured contemporaneously? If not, confirm that no quantitative productivity or authorship claims should be included | Section 2 discusses observable artifacts and inferred benefits only. It makes no percentage-of-code or time-saved claims |

Q01–Q02, Q04–Q09 and Q18–Q19 are the principal evidence gaps for these sections. No new requirement to obtain evidence from the team is treated as permission to invent the missing facts. Section drafts can be revised when actual records or explicitly identified recollections are supplied.

## Stage 3 clarification requests

These requests concern missing prompt-chain evidence. They do not prevent completion of Section 3. No original prompt text has been reconstructed as a quotation.

| ID / priority | Question / evidence requested | Effect on Section 3 |
| --- | --- | --- |
| Q21 / high | Are dated specification handoffs or separate debugging prompts retained for time clearing, status ordering, issuer proceeds and the gas mutation? Which fixes were initiated by the agent under the broad review request, and which received additional human instructions? | Extends Q04 and Q18. The section links specifications, regression commits and implementation changes without inventing bug-level prompts or claiming that instruction ambiguity caused the defects |
| Q22 / medium | Can the actual compaction summary and delegated Pages/README briefs and results be supplied, suitably redacted and dated? Were any requirements lost or corrected after compaction, and what records support that assessment? | Extends Q05. The edited log describes context preservation and delegation, but the underlying artifacts are absent. The section cannot verify complete context retention or reproduce delegated prompts |

Q04–Q05, Q08–Q09, Q18 and Q21–Q22 remain central to authenticating the representative chains. Q01–Q02 and Q14 also limit claims about brief compliance and lecture-based requirements. The original reason for the stale token address and the source of the initial allocation-policy divergence remain unknown, rather than being attributed to poor prompting.

## Stage 7 clarification requests

Sections 7 and 8 can stand as evidence-based drafts without answers to these questions. No missing answer has been supplied through inference.

| ID / priority | Question / evidence requested | Effect on Sections 7 and 8 |
| --- | --- | --- |
| Q23 / medium | Which of the proposed future practices has the team actually agreed to adopt, and which remaining findings will it prioritize? Provide any recorded decision on acceptance examples, browser integration tests, prompt retention and human review responsibilities | Section 8 presents these as recommendations derived from the audit, not as adopted practices or a unanimous retrospective team opinion |

Q18–Q19 and Q21 remain necessary to attribute individual improvements to human initiation or approval beyond the edited record. Q20 remains open for any measured effort reduction. No before-and-after gas-saving claim is made because the available gas evidence compares bidder populations and an intentional mutation, not equivalent historical production versions. Q22 remains open for context-loss claims. Q08–Q11 remain relevant to reproducing historical validation and deployment claims. Stage 6 has narrowly checked the earlier frontend leads, but complete browser and EVM validation remains outstanding as recorded in `testing_results.md`.

## Stage 8 integration status

The integrated report carries the outstanding confirmations into Appendix D. No team responses were inferred during integration. Q06 also governs the missing verified group-member and contribution details, so the title page does not invent names or student identifiers. Q16 now applies to the complete uncommitted audit folder, including the integrated report and its figure assets, rather than only the initial Stage 1 files.

The remaining document-production check is distinct from these project questions. DOCX structural and content checks passed, but the environment lacks the prescribed renderer and no Word application opening was verified. Page-by-page visual verification must be completed before Stage 8 can be marked complete. This is recorded in `audit_progress.md` and does not imply a newly discovered application defect.
