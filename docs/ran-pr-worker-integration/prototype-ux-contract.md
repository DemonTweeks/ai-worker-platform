# RAN PR Worker Prototype UX Contract

## Purpose

This document captures the platform-native user experience contract for the RAN PR Worker v1 integration. It is intentionally limited to the prototype contract required by Phase 0 and does not authorize reuse of upstream FastAPI, HTML, CSS, JavaScript, or job-status behavior.

## UX Principles

- Reuse the existing AI Worker Platform navigation model: home workbench, history, and job detail.
- Preserve existing MW external behavior while adding a second worker path.
- Present RAN as a platform worker, not as an embedded upstream app.
- Keep Standard PR non-interactive.
- Keep General Item project selection dynamic and validated from upstream workbook-backed configuration.
- Do not expose BOM Comparison as available functionality.

## User Entry Points

### Home Route

Primary route remains `/`.

The home experience must evolve from a single MW-oriented PR workbench into a worker-aware PR launch surface. The first prototype can stay on the existing route as long as it clearly distinguishes worker selection and does not break the current MW flow.

### History Route

Primary route remains `/history`.

History must continue to list job records in the existing platform style, but gain a worker identity dimension so users can distinguish MW and RAN jobs without requiring a separate RAN-only history page.

### Job Detail Route

Primary route remains `/jobs/:jobId`.

Job detail must continue to use the existing platform layout and include worker-specific audit metadata, outputs, warnings, review-required items, failure diagnosis, and downloads.

## Home Workbench Contract

### Worker Selection

The user must be able to choose between:

- `MW PR Worker`
- `RAN PR Worker`

The selection can be a segmented control, tabs, or a worker card picker, but it must be explicit and platform-native.

Default behavior should preserve the current MW-first experience unless a later implementation decision changes that deliberately.

### MW Mode

When `MW PR Worker` is selected:

- preserve the current upload, validation, scope, site-code, job creation, live console, and download behavior
- preserve current request and response shapes exposed by the backend
- preserve history/detail rendering semantics for existing MW jobs

### RAN Mode

When `RAN PR Worker` is selected, the home workbench must collect:

- BOM upload
- EPMS upload
- run mode
  - `Standard PR`
  - `General Item`
- dynamic General Item project selection when `General Item` is selected

The RAN flow must not ask the user to type arbitrary project strings.

### RAN Validation Behavior

The RAN prototype contract expects:

- both BOM and EPMS files are required before job creation
- the selected run mode is required
- a General Item project is required only when `General Item` mode is selected
- the available General Item projects come from validated upstream workbook-backed configuration
- invalid project names are rejected before worker execution

### RAN Launch Behavior

The create action should remain a single primary action similar to the current `Create Job` button.

The prototype launch payload conceptually needs:

- worker ID
- uploaded BOM reference
- uploaded EPMS reference
- run mode
- selected project when applicable

The user-facing launch interaction should still feel like one platform job submission, not a multi-step upstream wizard.

## Progress And Status Contract

RAN jobs must participate in the same platform progress model as MW jobs:

- queued
- running phases
- terminal states
- realtime updates in the home console and job detail timeline

The exact backend phase names may differ, but the frontend contract should continue to show:

- current status
- meaningful phase wording
- progress evidence when available
- final summary or safe failure explanation

## Download Contract

For RAN jobs, the platform must surface:

- individual tracked output files where appropriate
- ZIP package download
- job detail file availability and retention state

The user must download artifacts from platform-managed storage, not from the upstream fixed `output/` directory.

## History Contract

History must add worker awareness without forking the page into separate systems.

Minimum visible RAN history additions:

- worker badge or worker label on cards
- filtering by worker
- retained status, timestamps, output counts, warning counts, and summary preview

## Job Detail Contract

Minimum RAN-specific detail additions:

- worker identity: `ran-pr`
- display name: `RAN PR Worker`
- engine version: `v1.0.0`
- engine commit: `239910e2816153339a94881597bbb95355059741`
- run mode: `standard-pr` or `general-item`
- selected project when applicable

The existing detail layout should continue to show:

- status and lifecycle timestamps
- output files and ZIP
- warnings
- review-required items
- failure diagnosis
- realtime event timeline

## Explicit Non-Goals In The UX

The prototype contract must not introduce:

- upstream web UI embedding
- upstream `/projects`, `/upload-bom`, `/upload-epms`, `/generate-pr`, or `/job-status` routes
- BOM Comparison button, tab, route, menu item, or launch option
- separate RAN history page
- separate RAN job ID scheme

## Implementation Guidance For Later Phases

- The prototype can initially keep MW and RAN on the same home route with worker-aware branching.
- The UI should prefer worker metadata and capability-driven rendering over hardcoded MW-only assumptions.
- The user should always perceive one coherent platform, even though the execution engines differ behind the scenes.
