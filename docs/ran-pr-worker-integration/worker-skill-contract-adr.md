# Worker Skill Contract ADR

## Status

Accepted for implementation guidance during Phase 1 and Phase 2.

## Context

Phase 0 discovery established two important baselines:

- The current AI Worker Platform has a stable MW-oriented flow built around `/api/jobs`, Firebase-backed job/file metadata, platform-managed storage, websocket progress, cleanup retention, history, and job detail.
- The pinned upstream RAN engine at `v1.0.0` / `239910e2816153339a94881597bbb95355059741` contains reusable pipeline logic and workbook configuration, but also includes upstream-specific FastAPI/web layers, fixed `input/` and `output/` directories, global status handling, and bare-`python` subprocess execution that cannot be adopted directly.

The mission requires a reusable Worker Skill Contract that can support both `mw-pr` and `ran-pr` without changing existing MW external behavior.

## Decision

Adopt a four-part Worker Skill Contract:

1. Engine
2. Manifest
3. Platform Adapter
4. Worker Registry

The platform must treat MW and RAN as registered workers behind a shared contract while preserving platform-owned routing, persistence, history, files, and audit behavior.

## Contract Definition

### 1. Engine

The engine is the business-logic payload sourced from a worker implementation.

For `mw-pr`:

- existing internal MW scripts, assets, and execution behavior remain the source

For `ran-pr`:

- engine source comes from the pinned Git submodule at `skills/create-pr-cd-ran`
- reusable engine scope is limited to `src/`, `config/`, and validated templates/reference assets
- excluded upstream scope includes `api/`, `web/`, `build/`, `dist/`, `launcher.py`, `launcher.exe`, fixed `input/`, fixed `output/`, and generated artifacts

### 2. Manifest

Each worker must declare a manifest that the platform can inspect without executing the engine.

Minimum manifest fields:

- `workerId`
- `displayName`
- `engineRepository`
- `engineVersion`
- `engineCommit`
- `inputs`
- `outputs`
- `capabilities`
- `limitations`
- `compatibilityStatus`

Required `ran-pr` values include:

- `workerId: ran-pr`
- `displayName: RAN PR Worker`
- `engineRepository: ammarofficial11/create-pr-cd-ran`
- `engineVersion: v1.0.0`
- `engineCommit: 239910e2816153339a94881597bbb95355059741`
- capability `standard-pr`
- capability `general-item`
- limitation `bom-comparison not implemented`
- `compatibilityStatus: verified`

### 3. Platform Adapter

The adapter is the platform-owned layer that translates a platform job request into a safe engine run.

Responsibilities:

- validate worker-specific inputs
- create a unique isolated workspace per job
- copy approved engine assets into that workspace
- copy user uploads into workspace-local filenames expected by the engine
- resolve and invoke the correct Python interpreter explicitly
- run the approved stage sequence
- collect approved outputs into platform storage
- translate failures into safe platform error payloads
- expose lifecycle and cancellation behavior compatible with platform jobs
- emit engine audit metadata onto the job record

For `ran-pr`, the adapter must:

- never execute the upstream FastAPI server or HTML UI
- never execute via bare `python`
- never run directly against submodule `input/` or `output/`
- validate General Item projects from workbook-derived allowed values
- support Standard PR when no project is selected
- support General Item when a valid selected project is provided

### 4. Worker Registry

The registry is the explicit platform-controlled map of approved workers.

Required registered workers:

- `mw-pr`
- `ran-pr`

The registry must decide:

- how jobs are created
- which adapter executes them
- which manifest describes them
- how worker metadata is exposed to history and detail views

## Consequences

### Positive

- preserves a single platform experience across MW and RAN
- prevents engine-specific routing and persistence from leaking into the platform
- creates a clean path for audit metadata, future worker expansion, and capability-driven UI
- allows MW compatibility wrapping without rewriting the current user contract

### Negative

- requires extracting current MW assumptions that are hardcoded around `pr-worker`
- adds upfront complexity to job creation, history filtering, and job detail rendering
- requires careful staging so MW behavior does not regress while the registry is introduced

## Constraints Derived From Discovery

- Existing MW route and response contracts must remain stable.
- Worker identity must become explicit instead of relying only on `workerType: 'pr-worker'`.
- Platform persistence remains the system of record; RAN code must not write directly to Firebase or MongoDB.
- Platform storage remains the system of record; RAN outputs must be imported from isolated job workspaces.
- General Item validation must use workbook-derived project options, not the stale eight-entry CLI menu in upstream `src/run_pipeline.py`.
- The adapter must treat BOM Comparison as unavailable even though upstream code contains comparison workflows.

## Methodology Note

The `superpowers:brainstorming` skill normally requires interactive user approval before design handoff. For this autonomous mission checkpoint, that approval loop conflicts with the master prompt’s bounded-step wake-up model and instruction not to wait for routine approval. Per the mission rule, the mission constraints take precedence, and this document records that conflict explicitly.
