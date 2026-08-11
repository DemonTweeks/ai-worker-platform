# AI Worker Platform - Delivery Plan

## Outcome

The platform is a thin HTTP(S), storage, execution, and lifecycle wrapper for three standalone Python skills. Workbook, technical, and business logic stays inside each skill.

## Completed Workstreams

| Workstream | Delivered result |
| --- | --- |
| Contract 1.0 | `skill.json`, input envelope, NDJSON progress, cancellation, `result.json`, checksummed outputs |
| Generic API | `GET /api/skills` and `POST /api/skills/:skillId/jobs` |
| Package approval | Version and deterministic runtime SHA-256 verification |
| Generic runner | Isolated Python execution, timeout, cancellation, structural result validation, output persistence |
| Durable queue | Firebase atomic claims, machine/runtime identity, leases, heartbeat, restart reconciliation |
| `create-pr-cd` | TSS/TI standalone contract and authoritative reconciliation |
| `tx-pr-auditor` | Standalone audit contract, DU registry pin, 10,000-row capacity baseline |
| `create-pr-cd-ran` | BOM/EPMS standalone contract, project validation, four-stage pipeline, generic output ingestion |
| Frontend | Manifest-driven routes for MW/CD, RAN, and TX audit skills |
| Legacy retirement | Legacy launch pages, registry adapters, worker services, and auditor workspace/ingestion removed |
| Domain cleanup | Node prevalidation, workbook parsing, filtering, output reconstruction, and workbook/archive dependencies removed |
| Compatibility | Historical detail/download remains; generic rerun recreates stored contract inputs; legacy rerun returns a safe explanation |

## Current Structure

```text
backend/src/
|-- routes/skillRoutes.js
|-- skills/
|   |-- approvedSkills.json
|   |-- skillPackageService.js
|   |-- genericSkillJobService.js
|   `-- genericSkillRunner.js
|-- queue/jobQueue.js
`-- services/runtimeIdentityService.js

frontend/src/views/GenericSkillView.vue

skills/create-pr-cd/{skill.json,src/main.py}
skills/create-pr-cd-ran/{skill.json,src/main.py}
skills/tx-pr-auditor/{skill.json,src/main.py}
```

## Ongoing Release Gates

- Approved package SHA matches every included runtime file.
- Skill-owned standalone, domain, integration, and golden tests pass.
- Generic API, durable queue, and rerun contract tests pass.
- A successful result has valid output paths and checksums.
- Frontend unit tests, production build, and route smoke pass.
