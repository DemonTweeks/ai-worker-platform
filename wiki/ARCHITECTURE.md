# AI Worker Platform — Architecture

## Purpose

AI Worker Platform is an HTTP(S) control plane for standalone Python skills. It owns transport, safe storage, execution, durable lifecycle state, progress delivery, and downloads. It does not own workbook interpretation, technical calculations, or business decisions.

## Implemented Flow

```text
Manifest-driven Vue form
  -> GET /api/skills
  -> POST /api/skills/:skillId/jobs (multipart)
  -> generic manifest/file/parameter validation
  -> isolated storage/jobs/<jobId> workspace
  -> Firebase job + durable queue record
  -> atomic runtime lease claim
  -> python <skill-entrypoint> --input-manifest <skill-input.json>
  -> NDJSON progress relay
  -> structural validation of result.json
  -> opaque output registration and download
```

Approved packages are declared in `backend/src/skills/approvedSkills.json`. `backend/src/skills/skillPackageService.js` verifies the skill version, manifest, runtime files, and package SHA-256 before catalog exposure or execution.

## Ownership Boundary

| Concern | Platform | Skill |
| --- | --- | --- |
| HTTP(S), auth, routing | Owns | — |
| Upload size, extension, checksum, safe path | Owns | Declares constraints |
| Workbook/domain parsing | Must not own | Owns |
| Technical and business logic | Must not own | Owns |
| Job ID, idempotency, status, timeout | Owns | Cooperates |
| Queue ownership and restart recovery | Owns in Firebase | — |
| Progress | Relays NDJSON | Emits safe events |
| Output correctness | Checks contract and file identity only | Owns content |
| Downloads and retention | Owns | Declares outputs |

## Durable Queue

Firebase is authoritative. Process-local arrays, sets, and phase maps are rebuildable execution caches.

Each claimed job stores:

```json
{
  "queueState": "queued|running|cancelling|terminal",
  "machineId": "stable-host-id|null",
  "runtimeInstanceId": "per-start-id|null",
  "claimedAt": "timestamp|null",
  "heartbeatAt": "timestamp|null",
  "leaseExpiresAt": "timestamp|null",
  "reconciliationState": "pending|recovered|failed|null",
  "cancellationRequested": false
}
```

Claims and renewals use Firebase ETag transactions. A valid foreign lease rejects a competing runtime. Startup reconciles all non-terminal records before listening for HTTP traffic:

- `queued`: recover and requeue after an expired ownership record.
- Running phases: leave a valid lease alone; fail safely after lease expiry because current skills do not declare continuation.
- `cancelling`: finish cancellation after lease expiry.
- Terminal: never re-execute.

The same `machineId` with a different `runtimeInstanceId` is not considered the same owner.

## Skill Contract

A production skill provides:

- `skill.json` using schema `1.0`.
- A Python entrypoint accepting `--input-manifest`.
- Workspace-relative inputs and outputs.
- Safe NDJSON events.
- An authoritative `result.json` using contract `1.0`.
- Standalone, integration, domain, and golden tests.

The platform validates identity, status, paths, checksums, output existence, and optional reconciliation arithmetic. It does not interpret warning codes, workbook sheets, classification names, or business metrics.

## Implemented Skills

| Skill | Version | Contract entrypoint | Public inputs |
| --- | --- | --- | --- |
| `create-pr-cd` | `4.0.0` | `src/main.py` | `site_data` + TSS/TI selection parameters |
| `tx-pr-auditor` | `1.0.0` | `src/main.py` | one `final_po`, one or more `expected_ecc` |
| `create-pr-cd-ran` | `1.1.0` | `src/main.py` | one `bom`, one `epms`, run mode, optional project |

The generator and auditor skills are separate product jobs. The platform does not generate ECC as an implicit auditor step. A future composite workflow must be another standalone skill.

## Storage and Persistence

- Firebase: job lifecycle, queue ownership, status history, warnings, and file metadata.
- Local isolated workspace: uploaded files, input manifest, cancellation sentinel, result envelope, outputs, and protected logs.
- Result paths are checked against the job workspace before publication.
- Output SHA-256 is verified or calculated before metadata persistence.

## Cancellation and Progress

The runner writes `temp/cancel.requested` and allows cooperative cleanup before terminating the process. All current skill wrappers emit phase events and a 30-second progress heartbeat. The auditor checks cancellation every 250 rows in long loops; both creators supervise their existing domain processes so cancellation can terminate child work and still produce an authoritative result envelope.

## Historical Compatibility Boundary

The active registry and all launch routes are generic. Historical job detail and retained downloads remain supported. Generic jobs rerun from their stored contract inputs; legacy jobs return a safe compatibility explanation and are never dispatched to removed adapters.

## Runtime and Deployment Profiles

Git branches do not represent environments. `main` contains the complete local and production runtime behavior, and `AI_WORKER_PROFILE=local|production` selects configuration at process start.

All backend and frontend variables are co-located under `config/env/`:

- `local.env.example` and `production.env.example` define the tracked contracts.
- Ignored `local.env` and `production.env` hold machine-specific values and secrets.
- The Express configuration loader and Vite configuration read the same selected file.

Local mode on `main` runs backend and Vite directly, serves the hash-routed UI at `/`, and does not invoke a launcher or Nginx. The production-only launchers mount the same hash-routed UI at `/fe/` and send UI, API, health, and WebSocket traffic through the same-origin Nginx proxy. `VITE_APP_BASE` controls only the mount path; runtime profiles do not select a different frontend structure. The launchers use the current checkout and pinned submodule gitlinks; they never delete, recreate, or switch branches.

The generic skill launch view preserves the productized workbench structure from UI baseline `4d4148d7`: hero, workflow status, reference-style upload cards, configuration card, active Jobs, result delivery, cancellation, AI chatbox, and WebSocket-backed live output. `skill.json.ui` controls presentation copy, upload ordering, field controls, upload-column groups, conditional fields, informational stages, and hidden/default parameters. The executable contract remains `inputs`; UI metadata cannot introduce a file or parameter that the standalone Python skill did not declare. Client validation covers only manifest file constraints, while workbook parsing, domain prevalidation, and business logic remain inside the skill.

Production startup requires a stable `AI_WORKER_MACHINE_ID`. Firebase queue ownership therefore remains attributable to the deployment machine across application restarts while each runtime still receives a unique instance ID.

Approved package fingerprints canonicalize CRLF to LF for declared text runtime formats while hashing binary assets byte-for-byte. The same pinned package therefore has one identity on Windows and Linux without weakening workbook/template integrity checks.
