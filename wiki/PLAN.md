# AI Worker Platform — Thin Skill Wrapper Plan

## 1. Target Outcome

Refactor AI Worker Platform into a thin, contract-driven wrapper for standalone Python skills.

The platform will handle server concerns, HTTP(S) requests, authentication, generic input transport, skill invocation, job metadata, progress delivery, and result downloads. It will not contain technical processing logic or business logic.

Skills will follow the platform's manifest, invocation, event, and result contracts while remaining independently executable and testable through Python.

## 2. Design Principles

1. Skills are the only owners of domain and technical logic.
2. The platform treats domain files as opaque content.
3. The platform validates contracts, not business correctness.
4. New skills integrate through manifests and a generic runner.
5. A new skill should not require a new platform route or service.
6. Every skill must work standalone without Express, Firebase, or the frontend.
7. Platform lifecycle and security behavior must remain consistent across all skills.

## 3. Functional Ownership

| Concern | Platform | Skill |
| --- | --- | --- |
| HTTP(S), auth, routing | Owns | Does not own |
| Upload transport and safe storage | Owns | Consumes declared paths |
| Generic request schema | Owns | Declares parameters |
| Workbook/domain parsing | Must not own | Owns |
| Technical calculations | Must not own | Owns |
| Business decisions | Must not own | Owns |
| Job ID, status, timeout, cancellation | Owns | Cooperates through contract |
| Progress events | Relays and stores | Produces |
| Output content | Treats as opaque | Owns |
| Output metadata and download | Owns | Declares through result envelope |
| Domain tests and golden files | Must not duplicate | Owns |
| Platform contract tests | Owns | Must pass |

## 4. Target Flow

```text
Client
  -> HTTPS request with skill ID, parameters and files
  -> platform validates generic request contract
  -> platform stores opaque inputs and creates job
  -> registry resolves validated skill manifest
  -> generic runner creates isolated workspace
  -> runner invokes standalone Python entrypoint
  -> skill validates domain inputs
  -> skill executes all technical and business logic
  -> skill emits standard events and result.json
  -> platform validates only result contract and safe paths
  -> platform stores metadata and exposes outputs
  -> client reads status and downloads results
```

## 5. Target Components

```text
backend/src/
|-- api/
|   |-- skillRoutes.js
|   `-- jobRoutes.js
|-- skills/
|   |-- skillRegistry.js
|   |-- manifestSchema.js
|   |-- contractSchema.js
|   `-- skillRunner.js
|-- jobs/
|   |-- jobService.js
|   |-- jobRepository.js
|   |-- jobQueue.js
|   `-- jobReconciliationService.js
|-- storage/
|   |-- workspaceService.js
|   `-- fileService.js
|-- events/
|   |-- skillEventParser.js
|   `-- eventPublisher.js
|-- security/
|-- health/
`-- server.js

skills/<skill-id>/
|-- skill.json
|-- SKILL.md
|-- requirements.txt or pyproject.toml
|-- src/main.py
|-- config/
|-- assets/
`-- tests/
```

This is a target responsibility map. Physical movement should occur incrementally after contract tests exist.

## 6. Target Platform Functions

### `listSkills()`

- Reads approved manifests.
- Returns safe catalog metadata.
- Does not import or inspect skill implementation modules.

### `getSkill(skillId)`

- Resolves a validated manifest.
- Rejects disabled, missing, unapproved, or incompatible skills.

### `createJob(request, files)`

- Validates the generic request envelope.
- Enforces authentication, idempotency, file limits, and declared inputs.
- Stores files without domain parsing.
- Persists a generic job record.
- Enqueues the job using its skill ID and version.

### `runSkill(job)`

- Resolves the manifest and entrypoint.
- Creates an isolated workspace and input envelope.
- Starts the Python process.
- Applies timeout, cancellation, environment, and path controls.
- Captures standard events and the final result envelope.
- Does not contain branches for MW, RAN, Auditor, or future domains.

### `ingestResult(job, resultEnvelope)`

- Validates standard JSON schema.
- Verifies job/skill identity, safe paths, file existence, size, and checksum.
- Persists standard output metadata, warnings, summary, and error information.
- Does not parse or validate domain output content.

### `getJob()` and `listJobs()`

- Read generic job metadata and events.
- Return skill ID, version, lifecycle status, summary, warnings, and file metadata.

### `cancelJob()` and `rerunJob()`

- Apply generic lifecycle rules.
- Signal the running process without skill-specific cancellation logic.
- Preserve request and version provenance.

## 7. Skill Contract

The mandatory contract is documented in [SKILL_CONTRACT.md](SKILL_CONTRACT.md).

It covers:

- `skill.json` manifest
- Standard input envelope
- Python CLI invocation
- NDJSON progress events
- `result.json` envelope
- Output path rules
- Warning and error objects
- Exit codes
- Standalone compliance
- Compatibility and versioning

## 8. Migration From Current Architecture

The migration must preserve behavior while moving ownership into skills.

### Current platform logic to relocate or replace

| Current area | Target treatment |
| --- | --- |
| `prevalidationService.js` domain workbook checks | Move into each skill; retain only generic upload checks |
| `iepmsParser.js` | Move to the skills that understand IEPMS |
| `siteCodeParser.js` and `siteFilteringService.js` | Move into the relevant skill |
| `prWorkerService.js` | Replace with generic `skillRunner.js` |
| `ranWorkerService.js` | Replace with generic `skillRunner.js` |
| `prAuditorWorkerService.js` | Replace with generic `skillRunner.js` |
| Worker-specific output-ingestion services | Skills produce standard result envelopes |
| Worker-specific output validators | Move into each skill |
| Worker-specific branches in `jobService.js` | Replace with manifest-driven generic job creation |
| Worker-specific frontend payload code | Replace with manifest/schema-driven inputs where practical |

Do not delete existing platform behavior until the owning skill provides equivalent standalone behavior and passes golden tests.

## 9. Implementation Phases

### Phase 0 — Approve the contract

Tasks:

- Review `SKILL_CONTRACT.md` with platform and skill maintainers.
- Confirm manifest fields, input envelope, event protocol, result schema, exit codes, and version policy.
- Decide whether the platform discovers skills automatically or uses an approval registry.
- Decide how Python dependencies are installed and isolated.

Exit criteria:

- Contract version `1.0` is approved and frozen for implementation.

### Phase 1 — Build the generic contract layer

Tasks:

- Implement manifest and result JSON schemas.
- Implement registry discovery and compatibility validation.
- Add `/api/skills` catalog endpoints.
- Add contract fixtures and negative tests.

Exit criteria:

- A synthetic example skill is discovered and validated without worker-specific code.

### Phase 2 — Build the generic runner

Tasks:

- Create isolated workspaces and standard input envelopes.
- Invoke the manifest entrypoint.
- Parse NDJSON progress events.
- Apply timeout and cancellation.
- Validate `result.json` and register output metadata.
- Make output publication atomic.

Exit criteria:

- The synthetic example skill completes, fails, times out, and cancels through the same runner.

### Phase 3 — Make job APIs generic

Tasks:

- Replace worker-specific job creation payloads with a standard envelope.
- Persist skill ID, skill version, and contract version.
- Remove worker-specific routing from generic job lifecycle functions.
- Keep backward-compatible routes only as temporary adapters if required.

Exit criteria:

- Generic endpoints can run any compliant synthetic skill.

### Phase 4 — Migrate existing skills

For each of MW PR, RAN PR, and PR Auditor:

1. Add a compliant manifest and Python entrypoint.
2. Move missing platform-owned domain validation into the skill.
3. Produce standard events and result envelopes.
4. Prove standalone execution.
5. Run skill-owned unit, integration, and golden tests.
6. Run shared platform contract tests.
7. Switch the platform registration to the generic runner.

Migrate one skill at a time. Do not combine all three migrations into one unreviewable change.

### Phase 5 — Simplify the platform

Tasks:

- Delete replaced worker-specific parsers, services, adapters, and output ingestors.
- Reduce `jobService.js` to generic lifecycle orchestration.
- Replace worker-specific frontend runtime logic with manifest-driven forms where practical.
- Remove models and fields that exist only for one domain, or move them into generic JSON metadata.

Exit criteria:

- Core platform code has no MW, RAN, or PR Auditor business branching.

### Phase 6 — Durability and production hardening

Tasks:

- Implement queue restart reconciliation from [PENDING.md](PENDING.md).
- Require authenticated Firebase configuration.
- Validate Windows HTTP(S) deployment and service supervision.
- Add rate limits, authorization, resource controls, and audit coverage.
- Establish complete CI gates for platform contract tests and each skill's standalone tests.

Exit criteria:

- A restart cannot silently lose job ownership.
- Production configuration is explicit and secure.

## 10. Testing Strategy

### Platform tests

- Manifest schema and compatibility
- Generic request validation
- Safe file transport and workspace containment
- Process start, timeout, cancellation, and exit handling
- Progress-event parsing
- Result-envelope validation
- Output metadata and downloads
- Authentication, authorization, and audit
- Queue durability and restart behavior

Platform tests use synthetic skills and must not require MW, RAN, or Auditor business fixtures.

### Skill tests

- Domain input validation
- Technical transformations
- Business rules
- Templates and configuration
- Domain warnings and errors
- Output correctness
- Golden comparisons
- Standalone Python execution
- Platform contract compliance

## 11. Definition of Done

The refactor is complete when:

- All production skills run through one generic runner.
- Every skill runs standalone with the same input and result contracts.
- The platform does not parse domain workbooks.
- The platform contains no domain calculations or business-rule decisions.
- Adding a compliant skill requires no new platform lifecycle service.
- Platform tests use synthetic skills for generic behavior.
- Skill repositories own domain tests and golden evidence.
- HTTP(S), security, job state, storage, and result delivery remain platform-owned.
- Queue restart behavior and production Firebase controls are implemented.

## 12. Review Questions

The following choices should be confirmed before coding:

1. Should skills be auto-discovered or explicitly approved in a registry?
2. Should job execution remain queued/asynchronous, or may short skills run synchronously?
3. How are per-skill Python dependencies isolated on Windows?
4. Are manifest-driven generic forms sufficient, or are versioned UI extensions allowed?
5. Which metadata belongs in the standard result envelope versus skill-specific `details`?
6. What compatibility period is required for the current worker-specific APIs?
7. May more than one backend instance claim jobs?
