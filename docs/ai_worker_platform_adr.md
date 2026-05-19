# Architecture Decision Record (ADR): AI Worker Platform — PR Worker MVP

## ADR-001 — Product Strategy

### Decision

Use **Internal Tool first**, while designing the architecture to be future-ready for a **Multi-Skill AI Worker Platform**.

### Context

The initial use case is PR/ECC generation using the existing `create-pr-cd` skill/repo. However, the longer-term direction may include additional workers such as BOQ Worker, EHS Reviewer, L1 Checker, PAC Worker, MW Planning Checker, and Site Navigator Worker.

### Alternatives Considered

```text
A. PR-only WebApp
B. Full AI Worker Platform from day one
C. Internal PR Worker MVP with future platform-ready architecture
```

### Final Decision

Select option C.

### Rationale

```text
- Allows fast MVP delivery
- Keeps current scope controlled
- Avoids over-engineering first release
- Preserves future extensibility
- Matches long-term OpenClaw / AI operations direction
```

### Consequences

The MVP will only expose PR Worker, but backend concepts such as worker type, job model, and skill execution should not be hardcoded only for PR.

---

## ADR-002 — Worker Model

### Decision

Use **Skill-based Worker Model**.

### Context

Future platform may support multiple workers. The user experience should feel like assigning tasks to different specialist AI workers.

### Alternatives Considered

```text
A. Skill-based Worker
B. Unified Master Worker
C. Hybrid Master Worker + Specialist Workers
```

### Final Decision

Select option A.

### Rationale

```text
- Clear responsibility per worker
- Easier to onboard future skills
- Easier to maintain business logic separation
- Matches professional digital worker concept
```

### Consequences

The platform will expose workers such as:

```text
PR Worker
BOQ Worker
EHS Worker
L1 Worker
PAC Worker
```

Phase 1 only implements PR Worker.

---

## ADR-003 — Execution Model

### Decision

Use **Async Job Model**.

### Context

PR/ECC generation may take time depending on iEPMS export size, selected sites, and output volume. Users should not be forced to wait in a blocking browser session.

### Alternatives Considered

```text
A. Blocking request-response
B. Async job model
```

### Final Decision

Select option B.

### Rationale

```text
- Better user experience
- Supports long-running tasks
- Supports WebSocket progress updates
- Supports job history
- Supports future OpenClaw trigger
```

### Consequences

Every Generate action creates a new Job. Job state is persisted in MongoDB and can be viewed later.

---

## ADR-004 — User Authentication Model

### Decision

Normal users do **not** need login. Admin users require login.

### Context

This is an internal network tool for quick adoption. Normal users should be able to use PR Worker with minimal friction.

### Alternatives Considered

```text
A. All users login
B. No login at all
C. No user login, admin login only
```

### Final Decision

Select option C.

### Rationale

```text
- Reduces user friction
- Suitable for internal network deployment
- Protects admin asset management
- Keeps MVP simple
```

### Consequences

All users can access PR Worker and Job History. Admin Portal requires username/password.

---

## ADR-005 — Technology Stack

### Decision

Use the following stack:

```text
Frontend: Vue2
Backend: Express.js / Node.js
Database: MongoDB local
Realtime: WebSocket
Excel Parsing: xlsx / SheetJS
Excel Output: ExcelJS
Storage: Local Windows folder
Deployment: Windows 11 Pro + Docker Desktop + Docker Compose
LLM: Internal MaaS Gateway Qwen3-235B-A22B
```

### Context

The platform will run first on an internal Windows 11 Pro machine. The user confirmed preference for Vue2, Express.js, MongoDB/Firebase-style stack, and WebSocket-based progress.

### Alternatives Considered

```text
A. Next.js + FastAPI + PostgreSQL + Celery
B. Vue2 + Express.js + MongoDB + WebSocket
C. Firebase-first stack
```

### Final Decision

Select option B.

### Rationale

```text
- Matches preferred technology direction
- Simple deployment for Windows 11 Pro
- Node.js suitable for single-process MVP
- MongoDB fits flexible job metadata
- WebSocket supports human-like worker progress
```

### Consequences

Queue and worker orchestration will be implemented inside the Express runtime for Phase 1.

---

## ADR-006 — Runtime Model

### Decision

Use **Single Express Process** for Phase 1.

### Context

The system is deployed internally on one Windows 11 Pro machine. Operational simplicity is more important than distributed scalability for MVP.

### Alternatives Considered

```text
A. Single Express process handles API, worker, WebSocket
B. Separate API, worker, and WebSocket services
C. Single process in Phase 1, split later
```

### Final Decision

Select option A.

### Rationale

```text
- Fast MVP delivery
- Lower deployment complexity
- Easier debugging
- Suitable for small internal usage
```

### Consequences

The Express process will handle REST API, WebSocket server, job queue, worker execution, admin auth, and LLM client.

---

## ADR-007 — Skill Execution Integration

### Decision

Use **Child Process Execution** for `create-pr-cd`.

### Context

The create-pr-cd repo/skill may evolve independently. Directly embedding its internal logic into backend may tightly couple the platform to one skill implementation.

### Alternatives Considered

```text
A. Direct import / embedded integration
B. Child process execution
C. Separate microservice
```

### Final Decision

Select option B.

### Rationale

```text
- Loose coupling
- Better crash isolation
- Allows Codex to iterate skill independently
- Backend remains orchestration layer
- Easier future multi-skill execution model
```

### Consequences

Express worker will prepare inputs, spawn the create-pr-cd process, capture stdout/stderr, collect outputs, and update job state.

---

## ADR-008 — Repository Strategy

### Decision

Use **same repository** for platform and first skill.

### Context

The user wants simpler development and deployment. Separate repo or submodule would increase operational complexity.

### Alternatives Considered

```text
A. Same repository
B. Separate repo + git submodule
C. Separate repo + manual sync
```

### Final Decision

Select option A.

### Rationale

```text
- Simpler MVP development
- Easier Codex work
- Easier deployment
- Single source of control
```

### Consequences

Repo structure will contain frontend, backend, skills, storage, docker, and docs folders.

---

## ADR-009 — Input Model

### Decision

User uploads only the **iEPMS Export / Site PR/PO View**. PR Model, Contract Info, and ECC Template are system-managed assets.

### Context

Business users should not need to upload system configuration files each time. This reduces wrong template/version risk.

### Alternatives Considered

```text
A. User uploads all files
B. User uploads only iEPMS export, system manages assets
C. Mixed model
```

### Final Decision

Select option B.

### Rationale

```text
- Reduces user error
- Improves standardization
- Enables admin version control
- Better enterprise UX
```

### Consequences

Admin Portal must support asset upload, activation, version history, and audit logging.

---

## ADR-010 — Site Selection Model

### Decision

Support both:

```text
Generate by Site Code
Generate All Sites
```

### Context

The user input file is an iEPMS database export. Users may want to generate PR for selected sites or all eligible sites.

### Alternatives Considered

```text
A. Always process full export
B. Only process user-entered site codes
C. Support both selected sites and all sites
```

### Final Decision

Select option C.

### Rationale

```text
- Supports operational flexibility
- Prevents accidental full export processing
- Aligns with site-specific PR generation workflow
```

### Consequences

If no site code is entered and Generate All Sites is not selected, Generate is blocked and PR Worker asks user to choose a scope.

---

## ADR-011 — Site Code Matching

### Decision

Site code matching is case-insensitive and normalized.

### Context

Users may paste site codes with inconsistent casing, spacing, duplicates, or hidden characters.

### Final Decision

Normalize site code input by:

```text
Trim spaces
Uppercase
Remove hidden characters
Deduplicate
```

### Additional Behavior

```text
Duplicate input site code: warning + process once
Unmatched site code: continue matched sites + record warning
```

### Consequences

Error / Warning Report must include duplicate input site codes and unmatched site codes.

---

## ADR-012 — Pre-validation

### Decision

Run pre-validation before allowing Generate.

### Context

Invalid Excel files should be detected before job execution.

### Alternatives Considered

```text
A. Validate before Generate
B. Validate during Generate
```

### Final Decision

Select option A.

### Rationale

```text
- Better user feedback
- Avoids failed job queue pollution
- Enables disabled Generate button
- Improves trust
```

### Consequences

Pre-validation result shows checklist plus AI Worker explanation. Generate button is disabled if validation fails.

---

## ADR-013 — Validation Rule Ownership

### Decision

Required sheet and column definitions are code-defined.

### Context

Phase 1 prioritizes stability over configurability.

### Alternatives Considered

```text
A. Hardcoded in code
B. Admin configurable
C. Phase 1 hardcoded, Phase 2 configurable
```

### Final Decision

Select option A.

### Rationale

```text
- Avoids admin misconfiguration
- Easier to test
- More stable for MVP
```

### Consequences

If iEPMS export format changes, developer updates code and redeploys.

---

## ADR-014 — LLM Role

### Decision

LLM is responsible for persona, progress explanation, result explanation, and Q&A. LLM does not perform deterministic PR/ECC generation logic.

### Context

The desired UX is like assigning work to a digital colleague. However, PR/ECC generation must remain deterministic and auditable.

### Alternatives Considered

```text
A. LLM generates output directly
B. Rule Engine generates output, LLM explains and communicates
```

### Final Decision

Select option B.

### Rationale

```text
- Prevents hallucination in business output
- Keeps output auditable
- Gives human-like experience
- Supports OpenClaw-style behavior
```

### Consequences

All PR/ECC outputs must come from create-pr-cd logic. LLM only communicates, explains, and answers based on structured job data.

---

## ADR-015 — LLM Data Access

### Decision

LLM may access complete job data through a controlled Job Data Access Layer.

### Context

Users may ask detailed questions about job results, unmatched sites, warnings, and REVIEW_REQUIRED items.

### Alternatives Considered

```text
A. LLM only sees Summary
B. LLM sees Summary + Reports
C. LLM sees full structured job data through access layer
```

### Final Decision

Select option C.

### Rationale

```text
- Enables meaningful Q&A
- Avoids direct raw Excel exposure
- Keeps data retrieval controlled
```

### Consequences

Backend must retrieve relevant job data, structure context, and send only relevant context to LLM.

---

## ADR-016 — Communication Language and Style

### Decision

Worker communication is **English only**, with professional corporate tone and human collaboration feel.

### Context

The internal tool should feel like a professional digital colleague, not a cold system or casual chatbot.

### Final Decision

Use:

```text
English only
Professional Corporate
Human Collaboration Feel
Moderately Proactive
```

### Consequences

All Worker messages, progress updates, explanations, and completion summaries should be generated in English.

---

## ADR-017 — WebSocket Progress Model

### Decision

Use 5-second timed heartbeat updates, with major events pushed immediately.

### Context

User wants the WebApp and OpenClaw experience to feel like a worker is actively handling the task.

### Alternatives Considered

```text
A. Event-only updates
B. Timed heartbeat
C. Hybrid event + heartbeat
```

### Final Decision

Select option B, with major events also pushed immediately.

### Rationale

```text
- Stronger human-like task progress feeling
- Reduces perceived waiting time
- Helps long-running jobs feel alive
```

### Consequences

Backend must maintain job progress state and send heartbeat updates every 5 seconds while running.

---

## ADR-018 — WebSocket Recovery

### Decision

Support auto reconnect and resume live status.

### Context

Users may refresh browser, lose network briefly, or reopen the page during long-running tasks.

### Final Decision

WebApp should reconnect WebSocket, reload active job state, and resume progress display.

### Consequences

Backend must expose active job state and WebSocket subscription by jobId.

---

## ADR-019 — Multi-tab Behavior

### Decision

Each browser tab operates independently and subscribes to its own job channel.

### Context

Normal users do not login and may open multiple jobs in multiple tabs.

### Final Decision

Each WebSocket connection subscribes to a specific jobId.

### Consequences

Backend sends only events for the subscribed jobId.

---

## ADR-020 — Job History

### Decision

Job History is permanently retained and visible to all users.

### Context

Normal users do not login, and internal users should be able to find recent or historical jobs.

### Alternatives Considered

```text
A. User-only history
B. Admin-only history
C. Everyone can see Job History
```

### Final Decision

Select option C.

### Consequences

Job metadata, summary, final worker summary, review metadata, and asset versions are permanently retained.

---

## ADR-021 — Conversation Persistence

### Decision

Do not save full conversation. Save only final worker summary.

### Context

The UI needs a human-like conversation panel, but full chat persistence is not required.

### Alternatives Considered

```text
A. Do not save conversation
B. Save full conversation
C. Save only final summary
```

### Final Decision

Select option C.

### Rationale

```text
- Keeps job history readable
- Reduces storage/noise
- Preserves human-like result context
```

### Consequences

Job detail page shows final worker summary, not full runtime conversation.

---

## ADR-022 — Job History UI

### Decision

Use hybrid Job History UI: filter/search/statistics at top, job cards below.

### Context

The system needs both enterprise operation usability and AI worker readability.

### Alternatives Considered

```text
A. Table only
B. Card only
C. Hybrid
```

### Final Decision

Select option C.

### Consequences

Job History page includes filters, search, summary stats, and readable job cards.

---

## ADR-023 — Job Detail Re-Ask

### Decision

Job Detail supports temporary Re-Ask PR Worker Q&A.

### Context

Users may open old jobs and ask why a site was REVIEW_REQUIRED or why output count differs.

### Final Decision

Allow Re-Ask based on structured job data. Do not save Q&A.

### Consequences

Job Detail includes a temporary PR Worker ask panel.

---

## ADR-024 — File Retention

### Decision

Keep job metadata forever. Keep uploaded files and generated output files for 180 days.

### Context

Storage usage will grow over time. Summary and audit data should remain available, while large Excel files can expire.

### Final Decision

```text
Permanent:
- Job metadata
- Summary
- Final worker summary
- REVIEW_REQUIRED metadata
- Asset version record

180 days:
- Uploaded iEPMS Export
- ECC Output Files
- Error / Warning Reports
- Temporary generated files
```

### Consequences

Old job details may show expired file status. Phase 2 may support regeneration.

---

## ADR-025 — Admin Asset Management

### Decision

Admin Portal manages PR Model, Contract Info, and ECC Template.

### Context

These assets should not be uploaded by normal users. They change over time and need controlled management.

### Final Decision

Admin can upload new versions and activate them.

### Consequences

Admin Portal includes asset upload, version history, activation, and audit logs.

---

## ADR-026 — Asset Versioning

### Decision

System auto-generates asset version names. Old versions are kept forever.

### Context

Each job must record which asset versions were used for traceability.

### Final Decision

Example version names:

```text
PR_MODEL_20260519_153045
CONTRACT_INFO_20260519_153102
ECC_TEMPLATE_20260519_153515
```

### Consequences

Job record stores active asset versions at execution time.

---

## ADR-027 — Asset Activation

### Decision

Admin can activate uploaded asset version directly. No approval workflow required.

### Context

MVP should remain simple.

### Final Decision

Admin uploads, then activates. No secondary approval.

### Consequences

Admin action audit is mandatory.

---

## ADR-028 — Admin Asset Validation

### Decision

System performs only basic technical validation for asset upload. Admin is responsible for business correctness.

### Context

Deep business validation may be complex and not required for MVP.

### Final Decision

Basic validation includes:

```text
File exists
File type allowed
File readable
Not corrupted
```

### Consequences

Bad business content in asset file may cause later job issues. Admin responsibility and audit trail are important.

---

## ADR-029 — Admin Authentication

### Decision

Use simple username/password for Admin login.

### Context

Phase 1 runs internally on Windows 11 Pro and does not require company SSO.

### Final Decision

Use local DB authentication with password hashing.

### Consequences

Phase 1 has one preset admin account. Phase 2 may add admin account management.

---

## ADR-030 — Admin Audit

### Decision

Admin actions must be audited.

### Context

Admin can update critical system assets that affect PR output.

### Final Decision

Audit events include:

```text
Login
Logout
Asset upload
Asset activate
Password change
Configuration change
```

### Consequences

Admin audit collection is required in MVP.

---

## ADR-031 — Batch Mode

### Decision

Support batch processing in one job.

### Context

One iEPMS export may contain multiple sites, subcon, region, and scope combinations.

### Final Decision

One upload and one Generate action can produce multiple ECC outputs.

### Consequences

Output handling must support multiple files, individual download, and ZIP package download.

---

## ADR-032 — Output Naming

### Decision

Use existing naming convention:

```text
{Region}-{Subcon} TX Mini Project {Scope} PR {YYYYMMDD}.xlsx
```

### Context

This follows current user expectation and existing create-pr-cd naming behavior.

### Consequences

Backend output collector must preserve this naming standard.

---

## ADR-033 — REVIEW_REQUIRED Behavior

### Decision

REVIEW_REQUIRED rows do not generate ECC lines.

### Context

Rows that cannot be safely processed should not be included as final ECC line output.

### Final Decision

REVIEW_REQUIRED items go to REVIEW_REQUIRED report and Error / Warning Report.

### Consequences

Generated ECC output may exclude some requested rows.

---

## ADR-034 — Duplicate Behavior

### Decision

Duplicate detection does not block generation. Duplicate is reported as warning.

### Context

User selected Generate Anyway for duplicate handling.

### Final Decision

Generate output and write duplicate warning into Error / Warning Report.

### Consequences

Users must review warning report before submission.

---

## ADR-035 — Output Delivery

### Decision

Support individual file download and ZIP package download.

### Context

Batch mode may generate many ECC files.

### Final Decision

Users can download individual ECC files or one ZIP containing all outputs and reports.

### Consequences

Backend must generate ZIP package after job completion.

---

## ADR-036 — Job Cancellation

### Decision

User can cancel running job. Partial outputs are kept.

### Context

Async jobs may take time. User should be able to stop execution.

### Final Decision

Use graceful cancel. Keep completed partial outputs.

### Consequences

Additional status required:

```text
Cancelled
Cancelled with Partial Result
```

---

## ADR-037 — Failure Strategy

### Decision

Use hybrid failure strategy.

### Context

Some errors are recoverable, while critical processing errors should stop the job.

### Final Decision

```text
Recoverable errors: continue and record warning
Critical errors: fail job
Partial result: preserve successful outputs
```

### Consequences

Worker must classify errors and update job status accordingly.

---

## ADR-038 — Resource Protection

### Decision

Use hard limits for upload size, row count, requested site codes, timeout, and output count.

### Context

The system runs on Windows 11 Pro and must avoid overload.

### Final Decision

Initial limits:

```text
Max upload size: 100 MB
Max row count: 50,000
Max requested site codes: 5,000
Max job timeout: 60 minutes
Max generated output files: 200
```

### Consequences

Jobs exceeding limits are rejected with clear worker explanation.

---

## ADR-039 — Queue Policy

### Decision

Use FIFO queue with max 2 concurrent jobs.

### Context

Multiple users may submit jobs at the same time.

### Alternatives Considered

```text
A. Single job only
B. Multi-job queue
C. Priority queue
```

### Final Decision

Use FIFO with two concurrent jobs.

### Consequences

Additional jobs remain queued until a worker slot is available.

---

## ADR-040 — Health Dashboard

### Decision

Admin Portal includes Health Dashboard.

### Context

Internal operator needs quick system status.

### Final Decision

Health Dashboard shows:

```text
Backend status
MongoDB connection
Storage status
LLM connection
Queue status
Active jobs
Queued jobs
Disk usage
```

### Consequences

Backend must expose health check endpoints.

---

## ADR-041 — Future OpenClaw Integration

### Decision

OpenClaw will call the same backend API and receive conversational responses.

### Context

Future OpenClaw usage should feel the same as WebApp, not return cold machine JSON.

### Final Decision

OpenClaw becomes another client of the same PR Worker API.

### Consequences

Backend responses should include both machine result and assistant message where relevant.

---

## ADR-042 — Public Access Future

### Decision

Phase 1 internal network only. Future public access is possible but not part of MVP.

### Context

User wants possible public visit later, but current deployment is internal only.

### Final Decision

Use internal access first:

```text
http://10.x.x.x:3000
```

Future may add:

```text
HTTPS
Domain name
Reverse proxy
VPN / Zero Trust
```

### Consequences

Do not overbuild external access security in Phase 1, but do not block future upgrade.

