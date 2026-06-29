# AI Worker Platform Documentation

## Documentation Status

The current operational platform baseline is `main` after the RAN PR Worker merge at `29cbd382c92222b4f555d1926f106e1c66837404`.

The platform now runs two worker families: **MW PR Worker** and **RAN PR Worker**. Documentation is organized by whether it is current operating guidance or historical evidence.

## Start Here

| Document | Use it for | Status |
| --- | --- | --- |
| [Root README](../README.md) | Platform overview, worker inventory, local setup and regression commands | Current |
| [Platform Architecture and Operating Baseline](AI_Worker_Platform_Technical_Architecture_and_Business_Logic_Reference_v0.1.md) | Shared architecture, ownership boundaries, runtime rules and upgrade governance | Current |
| [RAN PR Worker Integration Technical Reference](AI_Worker_Platform_RAN_PR_Worker_Integration_Technical_Reference.md) | RAN-specific contract, validation, output lifecycle and maintenance rules | Current |
| [Windows Local Development and Deployment Guide](deployment-windows.md) | Windows developer setup, local run, controlled deployment and recovery | Current |
| [QA and UAT Checklist](qa-checklist.md) | Platform regression, MW smoke, RAN UAT and deployment checks | Current |

## Current Product Scope

| Capability | Status |
| --- | --- |
| MW PR Worker | Available |
| RAN Standard PR | Available |
| RAN General Item PR | Available |
| Worker-specific job history and Job Detail | Available through shared platform records |
| ZIP download and individual output download | Available |
| Safe failure diagnosis | Available |
| RAN BOM Comparison | Not implemented — future scope |

## Historical Evidence and Reference Material

The following areas are retained because they record how earlier work was performed or accepted. They are not the source for current commands or current feature availability:

- `ai-worker-style-refresh/` — completed UI refresh mission state, decisions and browser evidence
- `ran-pr-worker-integration/` — completed autonomous integration evidence, verification logs and review records
- `reference-website-analysis/` — design research reference
- `mvp-acceptance-report.md`, `ai_worker_platform_mvp_task_list.md`, `create_pr_cd_webapp_technical_design.md`, `ai_worker_platform_adr.md` — early MVP design and acceptance history
- `AI_Worker_Platform_Technical_Architecture_and_Business_Logic_Reference_v0.1.docx` — legacy Office snapshot; use the current Markdown operating baseline instead
- `prompts/result/` — historical implementation output records

When historical documentation conflicts with a current document, follow the current document and the code in `main`.

## Documentation Maintenance Rules

- Update the root README and the relevant current operating document in the same pull request as a user-visible capability change.
- Do not silently rewrite completed logs, state files, test evidence or historical acceptance reports; add a current supersession note or update this index instead.
- Document every new worker with its engine ownership, platform ownership, supported modes, deferred scope, test commands and upgrade policy.
- Do not describe roadmap items as implemented capability.
- Keep secrets, personal machine paths, generated Excel files, ZIP files and runtime workspaces out of documentation and Git history.
