# Stage 8 quality review

Content integration and structural verification passed on 23 October 2026. Final DOCX opening and rendered-page verification remain incomplete. These are distinct outcomes.

## Content coverage

| Required section | Review result |
| --- | --- |
| 1 Initial specification and scope | Original specification separated from revised allocation, original architecture and later features. Course-brief and TA uncertainty retained |
| 2 Methodology and AI tooling | Documented ChatGPT, Codex and Claude Code roles separated from conventional scripts. No authenticated model, individual authorship or productivity claim invented |
| 3 Specification engineering | Representative instruction chains are paraphrases of edited records. Missing original sessions, context summaries and bug-level prompts remain explicit |
| 4 Architecture | Two-contract boundary, state, authority, interfaces, wallet paths and dependencies preserved. Four figures explain current behavior without implying live deployment |
| 5 Problems and vulnerabilities | Six historical, five source-verified current and four provisional findings retained. False positives and verification limits preserved |
| 6 Validation and testing | 53 source definitions separated from the archived 52-test coverage record and nine newly executed audit check groups. Missing-tool failures are not reported as assertion failures or passes |
| 7 Improvements | Before/after comparisons are grounded in recovered revisions. Policy changes, cleanup, controls already present and added validation remain distinct |
| 8 Lessons | Recommendations are tied to observed policy ambiguity, UI counterexamples and missing reproducibility records. No context-loss cause or time saving invented |

The final pass rechecked source/configuration and historical records for status ordering, clearing-price rounding, proceeds accounting, quote/input wording, dependency versions, prompt provenance, TA assumptions, gas measurements and new audit command outcomes. Original drafts and evidence records remain the authority for their historical checkpoints.

## Artifact checks

The integrated Markdown is the canonical source for DOCX generation. Independent normalized Markdown-to-OOXML comparison passes. A second comparison validates 707 generated content blocks. Four identical image assets are referenced in Markdown and embedded in DOCX. Fourteen tables and four figure captions are present. All eight mandatory section headings occur in order. Twelve contents links resolve to internal bookmarks. Evidence identifiers and ranges resolve to the evidence register. No em dashes or semicolons occur in integrated text.

The DOCX ZIP has no bad members. All XML and relationship parts parse. Every embedded image relationship resolves. The document reopens with python-docx. This establishes package readability, not successful rendering by Microsoft Word. All eight preserved section hashes match their pre-generation values. Final file hashes are retained in `quality_checks.json`.

The first caption-count assertion also counted prose beginning with Figure 4.1 and similar references. The audit validator was corrected to distinguish short captions from narrative references. The report caption styling was narrowed accordingly. This was a document-check refinement, not an application test failure.

## Outstanding visual verification

Four diagram PNG assets were visually inspected for readability and clipping. The final revision to Figure 4.2 clarifies that acceptance is up to capacity. This does not constitute page-by-page DOCX inspection.

The prescribed renderer failed before PDF conversion because `soffice.exe` was not found. A first attempt additionally hit temporary-directory cleanup permissions. A repeat using a workspace-local temporary directory isolated the missing executable, with renderer exit code 1. Logs are retained in `render_attempt.txt` and `render_final_attempt.txt`. No rendered page count, clean pagination result or successful Word application opening is claimed. The Codex file-panel request returned queued only.

Stage 8 must remain pending until the existing DOCX is opened in a Word-compatible application, rendered and inspected on every page. Check table wrapping and repeated headers, code/path wrapping, figure-caption pairing, heading pagination and title/contents layout. If changes are needed, update the audit-only builder, regenerate, repeat structural/parity checks and inspect the new render. No application analysis or test rerun is needed to complete this document task.
