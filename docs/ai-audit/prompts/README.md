# Prompt Logs

Evidence for Section 3 of the AI Audit Report (Specification Engineering & Prompt Logs).
Three AI tools were used in sequence; each produced input for the next.

| Stage | Tool | What it produced | Log |
| --- | --- | --- | --- |
| 1. Planning | ChatGPT, run by Sanjeev | Project plan: naming, auction flow, contract/function outline, security checklist, test plan | [`chatgpt-plan.txt`](chatgpt-plan.txt), the plan as ChatGPT wrote it. No export or share link of the conversation is available |
| 2. First implementation | Codex desktop agent | `FairLaunch` contracts, tests, React app, docs (commit `0a75a78`) | Run by Sanjeev: the prompt is P01, in its original wording in [`codex-p01-original.md`](codex-p01-original.md) (his [Codex prompt log](https://drive.google.com/file/d/1C8xUpdNeH2EkowMe0tveSRG3fY06Z_vd/view) paraphrases each prompt); Codex's own summary and decisions are in [`../development-log.md`](../development-log.md) |
| 3. Cross-model review and remediation | Claude Code (Claude Opus 5.5, VS Code extension) | Review of stages 1-2, regression tests, contract fixes, fuzz/invariant tests, Slither, frontend rebuild, this documentation (commits `35253ce`..) | [`claude-code-session.md`](claude-code-session.md) |
| 4. Independent reviews | Codex, run separately by Sanjeev and by Alfred (ChatGPT Codex, Astra model) | Two defect audits, kept unchanged in [`../independent-review/`](../independent-review/README.md) | Alfred: [shared Codex session](https://chatgpt.com/s/cx_6ae9e517ff7c8191aaae189a076bc9de). Sanjeev: P10-P21 in his [Codex prompt log](https://drive.google.com/file/d/1C8xUpdNeH2EkowMe0tveSRG3fY06Z_vd/view), which also covers his wallet tests and the live-run timekeeping. His redesigns: [shared Claude session](https://claude.ai/share/3d6cc119-122a-404b-a457-77d3e28d5afe) |

Raw session transcripts for Claude Code are stored locally by the tool under `~/.claude/projects/`.
The Claude Code log keeps the prompts in their original order, edited for grammar and tone only; see the
note at the top of [`claude-code-session.md`](claude-code-session.md).
