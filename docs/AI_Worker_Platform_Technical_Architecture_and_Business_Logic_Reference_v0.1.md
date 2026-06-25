# AI Worker Platform - Technical Architecture and Business Logic Reference (v0.1)

**Status:** Approved design decisions; implementation pending  
**Reference date:** 25 June 2026  
**Scope:** AI Worker Platform worker-skill model and RAN PR Worker integration baseline

## 1. Purpose

This document preserves the architecture, business rules, governance decisions, execution boundaries and acceptance model agreed before unattended development. It distinguishes confirmed decisions, target design and Phase 0 verification items.

## 2. Executive Summary

AI Worker Platform owns the product/runtime lifecycle: Vue UI, Express API, job creation, queueing, persistence, history, Job Detail, progress, downloads, ZIP packaging, audit visibility and safe failure diagnosis.

The upstream RAN repository `ammarofficial11/create-pr-cd-ran` remains the source of truth for RAN Python business logic, configuration, templates and approved samples. The platform does not merge Git histories or embed the RAN FastAPI/UI. It consumes the RAN engine as a pinned dependency and wraps it through a platform-owned Worker Skill Adapter.

## 3. Confirmed Architecture Decisions

1. Do not merge repository histories.
2. Use a pinned Git submodule at `skills/create-pr-cd-ran`.
3. Treat upstream FastAPI, web UI, launcher, build/dist, standalone tracking and download routes as prototype/reference only.
4. Introduce a small Worker Registry and Worker Skill Manifest Contract.
5. Wrap existing MW PR worker as `mw-pr`; add RAN PR worker as `ran-pr`.
6. Platform backend owns persistence, job lifecycle, access control and user-facing safe failures.
7. RAN Python engine never writes Firebase/Mongo directly.
8. RAN PR Worker v1 includes Standard PR + General Item.
9. BOM Comparison is `notImplemented` / deferred; no UI/API should claim support.
10. Every RAN job runs in a unique isolated workspace.
11. RAN upgrades use a dedicated compatibility upgrade PR with golden tests and MW regression.
12. Each RAN job records worker version and exact upstream commit.

## 4. Worker Skill Contract

A worker skill contains:

- **Engine:** domain rules, Python/Node processing, config and templates.
- **Manifest:** worker ID, inputs/outputs, version, capabilities and limitations.
- **Platform Adapter:** validation, isolated workspace, execution, cancellation, safe error mapping and output collection.
- **Worker Registry Entry:** explicit platform approval and dispatch mapping.

Suggested IDs:

```text
mw-pr
ran-pr
```

Suggested structure:

```text
ai-worker-platform/
├─ skills/
│  ├─ create-pr-cd/
│  ├─ create-pr-cd-ran/
│  ├─ firebase-db/
│  └─ worker-manifests/
├─ backend/src/workers/
│  ├─ workerRegistry.js
│  ├─ mwPrWorkerAdapter.js
│  └─ ranPrWorkerAdapter.js
└─ docs/
```

## 5. RAN PR Worker Business Logic

### Inputs

- BOM workbook
- EPMS workbook (fresh export for every real job)
- Mode: Standard PR or Standard PR + General Item
- General Item project selection, derived from and validated against upstream configuration

### Processing

```text
Upload → validation → platform job record → queue dispatch → isolated workspace
→ normalize → calculate → PR generation → ECC export → output collection → ZIP/history/detail
```

Core engine stages:

```text
src/simple_normalize.py
src/simple_calculation.py
src/simple_pr_generator.py
src/simple_ecc_export.py
```

### Outputs

- ECC PR output workbook
- ECC PR output with General Items when applicable
- Platform generated ZIP
- Shared History / Job Detail / downloadable file metadata

### Business Rules

- Standard PR must be fully non-interactive.
- General Item selection must not be an arbitrary user string.
- Do not claim General Item output in Standard PR mode.
- Do not invent zero metrics when execution fails; unknown values remain unavailable.

## 6. Persistence and History Model

RAN uses the same platform job repository and shared lifecycle as MW.

No separate `ran_jobs`, RAN-only history, RAN-only database tree or direct engine persistence is allowed.

Logical RAN job fields include:

```json
{
  "workerId": "ran-pr",
  "workerVersion": "v1.0.0",
  "engineCommit": "<pinned SHA>",
  "status": "queued | running | completed | failed | cancelled",
  "request": {
    "mode": "standard-pr | standard-pr-with-general-item",
    "selectedProject": "..."
  },
  "inputManifest": {},
  "outputSummary": {},
  "failureSummary": null
}
```

Phase 0 must inspect the actual current MW persistence path. Do not assume Firebase/Mongo details only from README.

## 7. Execution Isolation and Security

Every RAN job gets its own workspace:

```text
<storage>/jobs/<job-id>/
├─ input/
├─ engine/
├─ output/
└─ logs/
```

Do not execute in or copy runtime assets from:

```text
api/ web/ build/ dist/ launcher.py launcher.exe input/ output/ .env node_modules
```

Use the platform-resolved explicit Python interpreter. Do not rely on bare `python`; do not use `shell: true`.

## 8. Version and Upgrade Governance

Use immutable annotated upstream tags:

```text
v1.0.0 - initial platform-approved baseline
v1.0.1 - compatible bug/config/mapping correction
v1.1.0 - compatible capability/rule enhancement
v2.0.0 - breaking contract change
```

Upgrade process:

```text
Upstream tag → platform compatibility branch → update submodule SHA/manifest
→ RAN golden tests + MW regression → business review → merge platform PR
```

Never automatically follow upstream `main`; never move an existing release tag.

## 9. Golden Tests

Use upstream sample BOM/EPMS and known-correct outputs. Compare workbook business content, not raw Excel binary bytes:

- sheet names
- required columns
- row counts
- PR items
- materials
- quantities
- metadata and key summaries
- General Item presence/absence and values

Required evidence:

- Standard PR golden test
- General Item golden test
- workspace isolation/concurrency test
- invalid input/safe error test
- MW regression

## 10. Continuous Unattended Delivery

- **Phase 0:** discovery, ADR, runtime/persistence verification, manifests and plans.
- **Phase 1:** submodule, isolated adapter, Standard/General Item engine compatibility and golden proof.
- **Phase 2:** registry, backend lifecycle, persistence, output/ZIP, cancellation and error handling.
- **Phase 3:** platform-native RAN page, history/detail/download UX.
- **Phase 4:** full verification, final report and Draft PR only.

Codex may create worktrees, modify scoped code, test, debug, checkpoint commit and create a Draft PR.

Codex must not push main, merge, deploy, modify upstream source inside the submodule, or commit generated artifacts/secrets.

## 11. Current Operational Notes

- Intended upstream RAN baseline: local annotated tag `v1.0.0` at commit `239910e2816153339a94881597bbb95355059741`.
- Remote tag push is pending upstream GitHub Write permission for approved accounts.
- Verify the AI Worker Platform main worktree is clean before starting the unattended mission.
- Check/remediate any mistakenly created `v1.0.0` tag in AI Worker Platform; this tag should be reserved for the RAN engine repository.

## 12. References

- AI Worker Platform: https://github.com/DemonTweeks/ai-worker-platform
- RAN Engine: https://github.com/ammarofficial11/create-pr-cd-ran
- Unattended Development Methodology: https://github.com/Gumb-D/codex-unattended-development
