# AI Worker Platform — Target Architecture

## 1. Architecture Intent

AI Worker Platform is a thin server-side wrapper around standalone Python skills.

The platform is a control plane. It receives HTTP(S) requests, authenticates and validates the transport contract, stores job metadata and files, invokes a selected skill, reads the skill's standard result envelope, and returns status or downloadable results to the client.

The platform does not own technical processing logic or business logic. Every skill owns its domain validation, calculations, transformations, templates, and output correctness and must remain independently runnable with Python.

```text
Client
  |
  | HTTPS
  v
AI Worker Platform
  |-- API and authentication
  |-- generic request validation
  |-- skill registry and manifest reader
  |-- generic job lifecycle
  |-- safe Python process runner
  |-- metadata and file storage
  |-- event and result delivery
  |
  `--> Standalone Python skill
         |-- domain input validation
         |-- technical processing
         |-- business rules
         |-- output generation
         `-- standard platform result envelope
```

## 2. Core Boundary

### Platform owns

- HTTP(S) endpoints and request routing
- Authentication and authorization
- Generic request-schema validation
- Upload transport, size limits, hashing, retention, and safe paths
- Skill discovery and manifest validation
- Job identifiers, idempotency, state transitions, timeout, and cancellation
- Generic process invocation and resource controls
- Reading standard progress events and result envelopes
- Metadata persistence and file delivery
- Safe error presentation, audit logs, and health status

### Each skill owns

- Domain file parsing
- Required worksheet, column, and field validation
- Technical algorithms and transformations
- Business rules and decisions
- Domain configurations, templates, and reference assets
- Domain-specific warnings and review-required decisions
- Output naming within the skill contract
- Output content and correctness
- Skill-level unit, integration, and golden tests

### Platform must not own

- Worker-specific workbook parsers
- Worker-specific calculation services
- Copies of skill configuration or mapping tables
- Business-rule branching by worker ID
- Domain-specific output interpretation
- Domain-specific corrections or fallback calculations

The platform may validate only the standard contract around a skill result. It must not determine whether a domain result is commercially or technically correct.

## 3. Architectural Style

The target is a modular control-plane monolith with contract-driven skill plug-ins.

```text
Frontend or API client
        |
        v
HTTP(S) API
        |
        v
Generic Job Service
        |
        +--> Skill Registry ----> skill manifest
        |
        +--> Job Repository ----> Firebase metadata
        |
        +--> File Store --------> inputs and outputs
        |
        `--> Skill Runner ------> Python entrypoint
                                   |
                                   `--> events + result.json
```

Adding a new skill should normally require:

1. Adding the skill package.
2. Providing a valid manifest and standalone Python entrypoint.
3. Passing the platform contract tests.
4. Registering or discovering the skill.

It should not require new platform routes, services, parsers, database models, or UI lifecycle code.

## 4. Functional Request Flow

```text
1. Client requests the available skill catalog.
2. Platform reads validated skill manifests.
3. Client submits a job request and input files for a skill ID.
4. Platform validates only the generic transport contract.
5. Platform stores opaque input files and creates a job record.
6. Generic runner prepares an isolated job workspace.
7. Platform invokes the skill's Python entrypoint.
8. Skill validates domain inputs and performs all domain processing.
9. Skill emits standard progress events.
10. Skill writes output files and a standard result envelope.
11. Platform validates the envelope and safe output paths.
12. Platform persists metadata and exposes status and downloads.
```

Domain inputs are opaque to the platform. The platform may read file metadata and the standard JSON envelope, but it must not parse domain workbook contents.

## 5. HTTP(S) API

The target API is generic rather than worker-specific.

```text
GET    /health
GET    /api/skills
GET    /api/skills/:skillId
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:jobId
POST   /api/jobs/:jobId/cancel
POST   /api/jobs/:jobId/rerun
GET    /api/jobs/:jobId/files/:fileId
GET    /api/jobs/:jobId/download
WS     /ws
```

`POST /api/jobs` uses a standard request envelope containing the skill ID, contract version, idempotency key, generic parameters, and uploaded-file references.

HTTPS termination may be handled by the Windows host or an approved reverse proxy, but TLS configuration remains a platform/deployment responsibility.

## 6. Skill Registry

The registry reads and validates skill manifests. It must not contain business logic.

Registry responsibilities:

- Discover approved skill directories
- Validate manifest schema and contract version
- Resolve a skill ID to its entrypoint and execution limits
- Expose safe catalog metadata to clients
- Reject missing, disabled, incompatible, or unapproved skills
- Verify an approved version or runtime fingerprint when required

The detailed package and runtime contract is defined in [SKILL_CONTRACT.md](SKILL_CONTRACT.md).

## 7. Generic Skill Runner

The runner is the only platform component that starts Python skills.

It owns:

- Isolated workspace creation
- Input manifest creation
- Entrypoint resolution
- Python interpreter resolution
- Environment allowlisting
- Timeout and cancellation
- Standard output/event capture
- Exit-code capture
- Result-envelope discovery and schema validation
- Process and workspace cleanup

It does not interpret domain messages, calculate fallback results, or repair skill output.

## 8. Job State

The platform owns generic lifecycle states:

```text
accepted
  -> queued
  -> running
  -> succeeded
  -> succeeded_with_warning
  -> failed
  -> cancelling
  -> cancelled
```

Progress phases inside a skill are represented as opaque event codes plus safe display messages. The platform records and relays them without implementing their meaning.

Queue durability and restart reconciliation remain pending in [PENDING.md](PENDING.md#p-001--durable-queue-and-restart-reconciliation).

## 9. Data and Storage

### Metadata

Firebase stores generic platform records:

- Skill identity and version used by a job
- Job status and timestamps
- Request idempotency metadata
- Standard progress events
- File metadata
- Standard warnings and errors
- Audit records

### File content

Platform storage contains opaque inputs, skill outputs, and result envelopes:

```text
storage/jobs/<job-id>/
|-- input/
|-- work/
|-- output/
|-- result.json
`-- logs/
```

The platform verifies root containment, file existence, size, checksum, retention, and download authorization. It does not validate domain output content.

## 10. Frontend

The target frontend is schema- and manifest-driven where practical.

Shared UI owns:

- Skill selection and catalog display
- Generic file upload controls
- Parameter fields described by the skill manifest
- Job submission and idempotency
- Progress, cancellation, history, and downloads
- Display of standard summaries, warnings, and errors

A skill may declare presentation metadata, but it must not require platform business logic. Highly specialized user experiences should live with the skill as contract data or a separately versioned extension, not as business processing in the core platform.

## 11. Error Boundary

The skill returns a standard safe error object. Technical tracebacks remain in protected logs and are never returned directly to normal users.

The platform distinguishes only generic failure classes:

- Invalid platform request
- Skill unavailable or incompatible
- Skill rejected domain input
- Skill process failed
- Skill timed out
- Skill cancelled
- Result contract invalid
- Storage or persistence failed

Domain-specific error codes and safe messages originate from the skill.

## 12. Security Boundary

The platform owns:

- TLS and trusted proxy configuration
- Authentication and authorization
- Request and upload limits
- Safe path enforcement
- Process environment allowlisting
- Secret isolation
- Download authorization
- Audit logs and error redaction

Skills must not receive platform secrets unless explicitly declared and approved. Skills run with the smallest practical filesystem and environment access.

## 13. Standalone Skill Requirement

Every skill must run without the web platform through its documented Python CLI.

A standalone execution must accept the same input manifest, create the same result envelope, and follow the same exit-code contract used by the platform. This guarantees that skill development and domain testing do not depend on the frontend, Express, Firebase, or WebSocket layers.

## 14. Current-to-Target Gap

The current code contains worker-specific platform logic that conflicts with the target boundary, including:

- Worker-specific request branches in `jobService.js`
- Platform workbook parsing and domain prevalidation
- MW, RAN, and PR Auditor-specific worker services
- Worker-specific output ingestion and validation
- Worker-specific frontend workbenches and payload construction

These areas should be migrated behind the standard skill contract, then removed from the platform only after equivalent standalone skill behavior and contract tests are proven.

## 15. Target Quality Test

For any proposed platform code, ask:

> Would this code still be required if every existing skill were replaced by a new, unrelated Python skill following the same contract?

If the answer is no, the code probably belongs inside the dedicated skill rather than in AI Worker Platform.
