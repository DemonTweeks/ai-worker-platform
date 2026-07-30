# AI Worker Platform Ambiguity and Cleanup Analysis

## Document control

| Field | Value |
| --- | --- |
| Document | `ANALYSIS.md` |
| Purpose | Identify ambiguous structure, logic gaps, operational risks, and cleanup work |
| Analysis date | 29 July 2026 |
| Platform commit inspected | `a61c44314167f97f3fe1da096f41690a746e2d58` |
| Method | Static trace of frontend, backend, manifests, `create-pr-cd`, and `tx-pr-auditor`; targeted engine-integrity execution |
| Detailed design | `DETAILS.md` |

## 1. Executive assessment

The intended responsibility split is now materially better than the earlier alias-based integration:

- `create-pr-cd` is the formal owner of DU detection, exact source mapping, canonical validation, and ECC generation;
- `ai-worker-platform` owns uploads, selection, lifecycle, invocation, and delivery;
- `tx-pr-auditor` consumes generated ECC and Final PO only.

The design is not ready to call fully clean. One current checkout issue prevents backend startup, and several contracts are internally inconsistent or only indirectly enforced. The highest-value cleanup is:

1. restore a coherent engine pin;
2. preserve canonical review evidence through platform output handling;
3. distinguish nine governed DU identities from eight runnable identities;
4. emit explicit DU lineage in ECC instead of depending on filenames;
5. consolidate lifecycle, deployment, and persistence contracts.

## 2. Severity model

| Priority | Meaning |
| --- | --- |
| P0 | Blocks startup or can cause a materially false result |
| P1 | Significant integrity, correctness, or production-operability risk |
| P2 | Maintainability, observability, UX, or documentation debt |
| P3 | Low-risk cleanup |

## 3. Findings

### A-001 — Current MW checkout does not match the approved platform pin

**Priority:** P0  
**Status:** Confirmed by execution

Observed state:

| Reference | Commit |
| --- | --- |
| Platform gitlink | `98412d7ecab8e1ba6c53e170f3ffea30b75b3443` |
| MW manifest | `98412d7ecab8e1ba6c53e170f3ffea30b75b3443` |
| Current `skills/create-pr-cd` HEAD | `be074107a87ee650b233625c7edd2e1580a69e6b` |

`node backend/scripts/engine-integrity-test.js` fails with:

```text
ENGINE_COMMIT_MISMATCH
expectedCommit: 98412d7...
actualCommit: be074107...
```

The two commits have no content diff; `be074107` appears to be an equivalent rewritten/cherry-picked commit. The runtime fingerprint can still match, but Git identity is intentionally part of approval.

Impact:

- backend startup fails before listening;
- all workers are unavailable in this checkout.

Recommended resolution:

- choose one approved commit identity;
- either check out the recorded `98412d7`, or update the platform gitlink and MW manifest to `be074107`;
- keep the existing fingerprint only after recomputing and confirming it;
- perform the platform change on a dedicated branch;
- rerun engine integrity, backend tests, and demo flow.

Acceptance:

```text
git submodule status shows no leading +
manifest commit equals submodule gitlink
engine-integrity test passes
backend starts
```

### A-002 — Canonical review evidence is not preserved by platform output ingestion

**Priority:** P0  
**Status:** Confirmed by code trace

`create_pr.py` writes:

```text
CANONICAL_REVIEW_REQUIRED_TSS.csv
CANONICAL_REVIEW_REQUIRED_TI.csv
```

`outputCollector.classifyFileType()` classifies any name containing `review` as `review_required_report`. Later, `generateReportsAndPackage()` logically deletes all `review_required_report` records before creating the platform report. The canonical file is not recognized as `source_review_required`, and `tiResultIngestionService` only ingests `REVIEW_REQUIRED_TI_*.csv`.

Consequences:

- canonical review rows do not become `ReviewRequiredItem` records;
- the engine summary count is not used by `summaryBuilder`;
- `CREATE_PR_SUMMARY_<SCOPE>.json` is initially tracked as `summary`, then replaced by the platform summary record before packaging;
- matched sites with zero ECC and only canonical review evidence can be reported as `ZERO_OUTPUT_WITHOUT_EXPLANATION`;
- the canonical review file can remain physically present but become untracked and omitted from the ZIP.
- a registry-classified `REVIEW_REQUIRED` SOW can be partitioned for review while the CSV still shows `PR_INPUT_READY` with no blocking reason, because the partition reason is not added to the report.

Recommended design:

- add a distinct file type such as `source_canonical_review_required`;
- recognize `CANONICAL_REVIEW_REQUIRED_(TSS|TI).csv`;
- ingest its rows into `ReviewRequiredItem`;
- preserve the original engine evidence in the ZIP;
- persist the partition reason, including SOW normalization status/classification, in every canonical review row;
- use the trusted `CREATE_PR_SUMMARY_<SCOPE>.json` as a cross-check, not as the only source;
- add an integration test for “all selected records are canonical review-required and no ECC is generated.”

### A-003 — “Nine DU supported” has two different meanings

**Priority:** P1  
**Status:** Confirmed

Both registries contain nine unique Project + DU Model identities. However:

- eight identities have `PR_INPUT_READY` profiles with approved header hashes;
- CD consolidation 2023 has two `DRAFT` profiles and zero approved header hashes.

`tx-pr-auditor` recognizes all nine identities. `create-pr-cd` can generate only the eight runnable identities. The ninth fails closed.

Ambiguity:

- product/UI/docs can incorrectly state that all nine can generate ECC;
- audit may recognize historical CD consolidation ECC while current platform entitlement generation cannot reproduce it.

Recommended terminology:

| Term | Meaning |
| --- | --- |
| Governed/recognized identities | 9 |
| Runnable ECC-generation identities | 8 |
| Pending identity | CD consolidation 2023 |

Add explicit manifest capabilities:

```json
{
  "recognizedDuIdentityCount": 9,
  "runnableDuIdentityCount": 8,
  "pendingDuIdentities": ["Malaysia_CelcomDigi_Project::8359047522524182050"]
}
```

### A-004 — ECC does not carry explicit DU profile and View lineage

**Priority:** P1  
**Status:** Confirmed

`tx-pr-auditor` supports ECC columns for:

- DU Model;
- DU Model ID;
- DU Profile ID;
- DU View ID;
- DU Project Key.

The current `create-pr-cd` renderer writes none of these columns. Only the DU model name is embedded in the filename. Exact profile and View lineage exists in `CREATE_PR_SUMMARY_<SCOPE>.json`, but the auditor is invoked with the ECC directory and does not join that summary to individual ECC files.

Impact:

- model resolution depends on filename text;
- profile/View fields in audit output are expanded from the registry, not proven from the exact source export;
- CD consolidation has two profiles/Views under one identity and cannot be precisely attributed from filename alone;
- renaming an ECC file can make valid entitlement unknown or conflicting.

Recommended contract:

Prefer an explicit sidecar manifest per ECC file:

```json
{
  "eccFile": "...xlsx",
  "projectKey": "...",
  "duModelName": "...",
  "duModelId": "...",
  "profileId": "...",
  "profileVersion": "...",
  "mappingVersion": "...",
  "viewId": "...",
  "headerHash": "...",
  "scope": "TSS"
}
```

The auditor should require the sidecar or explicit workbook metadata for newly generated files, with filename inference retained only for approved legacy inputs.

### A-005 — Platform filtering and engine selection overlap

**Priority:** P1  
**Status:** Structural ambiguity

The platform:

- parses iEPMS headers;
- detects a site-code column from aliases;
- rewrites a filtered workbook;
- passes selection flags again to `create_pr.py`.

The engine:

- maps exact four-header fingerprints;
- derives canonical site code;
- applies `--site-code` or `--all-sites`.

The current rewrite preserves rows through the detected header, so a standard four-header export can remain resolvable. Nevertheless:

- all-sites jobs are rewritten even when no filtering is needed;
- SheetJS read/write can change cell types or workbook structure;
- platform site-code alias selection can diverge from the profile-owned canonical site field;
- the same selection is represented in two layers.

Recommended target:

- pass the immutable original source file to `create_pr.py`;
- pass only scope and site-code selection;
- let the canonical engine select records;
- use a lightweight platform preview/count only for UX, never as the execution input;
- if platform-side filtering must remain, define and test a byte-independent “four-header preservation” contract for every runnable DU profile.

### A-006 — Canonical `output_decision` contradicts ready classifications

**Priority:** P1  
**Status:** Confirmed

`empty_canonical_site_record()` initializes:

```text
output_decision = QUARANTINE_NO_ECC
```

`validate_canonical_site_record()` returns a classification but no output decision. `apply_validation_result()` therefore retains `QUARANTINE_NO_ECC`, including for `PR_INPUT_READY`. `create_pr.py` ignores `output_decision` and partitions using classification plus SOW status.

Impact:

- the canonical record can simultaneously say “ready” and “quarantine/no ECC”;
- future consumers may enforce the wrong field;
- the current pipeline succeeds only because one contract field is ignored.

Recommended resolution:

- set `ALLOW_ECC_OUTPUT` only for approved `PR_INPUT_READY`;
- explicitly decide whether `PR_INPUT_READY_WITH_REVIEW` may render;
- set `QUARANTINE_NO_ECC` for incomplete/quarantined states;
- make `_partition_records()` require the output decision;
- add invariant tests preventing contradictory classification/decision pairs.

### A-007 — Profile-level required fields leak across scopes

**Priority:** P1  
**Status:** Confirmed

`canonical_input_pipeline.py` defines required mappings as:

```text
scope-required fields
UNION
every profile field with required: true
```

Current profiles mark `subcontractor_ti`, `existing_tss_pr_status`, and `existing_ti_pr_status` as globally required. As a result:

- a TSS run also requires the TI subcontractor and TI existing-PR source mappings;
- a TI run also requires the TSS existing-PR source mapping.

Impact:

- a scope-capable export can fail because another scope’s source column is missing;
- “required” has unclear meaning: universal, profile onboarding, or per-scope.

Recommended schema:

```json
{
  "required_for_scopes": ["TI"]
}
```

Alternatively, keep profile mappings structural and make all runtime requiredness come exclusively from `SCOPE_REQUIRED_FIELDS`.

### A-008 — Existing-PR behavior differs between TSS and TI without a formal mode

**Priority:** P1  
**Status:** Confirmed, business decision required

TI partitions `PR_EXISTS` as duplicate and blocks generation. TSS deliberately allows existing PR rows so entitlement remains available for downstream Final PO audit comparison.

The same `create_pr.py` entrypoint is used for:

- standalone MW PR creation;
- PR Auditor entitlement generation.

Therefore TSS standalone generation can include a site with an existing TSS PR, while TI cannot.

Required decision:

- Is TSS existing-PR generation valid for both use cases?
- Or should the entrypoint support an explicit mode such as:

```text
--purpose create
--purpose audit-entitlement
```

Do not infer purpose from output directory or caller.

### A-009 — Structured `create-pr-cd` errors are flattened

**Priority:** P1  
**Status:** Confirmed

`create_pr.py` emits structured JSON errors such as:

- `DU_PROFILE_VIEW_NOT_APPROVED`;
- `HEADER_HASH_REVALIDATION_REQUIRED`;
- `SITE_CODES_NOT_FOUND`;
- `ECC_RENDERER_FAILED`.

`childProcessRunner` converts every nonzero result to `WORKER_PROCESS_FAILED` and retains only tail stdout/stderr in technical details.

Impact:

- UI loses actionable engine error codes;
- History and Re-Ask cannot distinguish a new View from a missing site or renderer failure;
- support staff must inspect nested stderr text.

Recommended resolution:

- parse the final JSON object from stderr;
- allowlist stable engine codes and safe detail fields;
- persist `engineErrorCode` separately from platform `WORKER_PROCESS_FAILED`;
- map each stable code to a safe title, explanation, and next action;
- retain raw stderr only in protected diagnostics.

### A-010 — PR Auditor progress stages are descriptive, not actual stages

**Priority:** P2  
**Status:** Confirmed

Seven stages are declared:

```text
Validating files
Generating TSS entitlement
Generating TI entitlement
Loading generated ECC entitlement
Auditing PO records
Resolving duplicates
Generating audit report
```

Callbacks are emitted only for TSS generation, TI generation, and the whole auditor process. The middle audit phases execute inside one Python process with no progress protocol.

Impact:

- progress jumps;
- stage names imply observability that does not exist;
- timeout diagnosis cannot identify the audit substage.

Recommended options:

1. simplify UI to three truthful execution stages; or
2. define a JSON-lines progress protocol from `tx-pr-auditor` and forward real stage events.

### A-011 — RAN engine is pinned but not fingerprint-verified

**Priority:** P1  
**Status:** Confirmed

Startup integrity verifies MW and PR Auditor only. `ranPrManifest.js` has a commit but no runtime fingerprint or runtime file list, and `assertPlatformEngineIntegrity()` excludes RAN.

Impact:

- an uncommitted modification inside the RAN checkout can run;
- deployments without readable Git metadata have no RAN content verification;
- the documented “approved pinned engine” standard is inconsistent by worker.

Recommended resolution:

- add a transitive RAN runtime file list and SHA-256 fingerprint;
- verify it at startup;
- add RAN to `engine-integrity-test.js`;
- define one shared integrity-failure presentation policy.

### A-012 — Deployment composition describes MongoDB, but runtime uses Firebase

**Priority:** P1  
**Status:** Confirmed

`docker-compose.yml`:

- starts MongoDB;
- makes backend depend on MongoDB;
- sets `MONGO_URI`.

Backend:

- has no MongoDB dependency;
- ignores `MONGO_URI`;
- uses Firebase REST;
- reports Firebase as `services.mongodb` for backward compatibility.

Impact:

- operators may back up or monitor the wrong datastore;
- backend can wait for an irrelevant container;
- health dashboards mislabel persistence;
- container configuration does not explicitly pass `FIREBASE_DB_URL`.

Recommended resolution:

- remove MongoDB service and `MONGO_URI` if migration is complete;
- pass Firebase configuration explicitly;
- rename health fields and update frontend;
- retain compatibility aliases for one deprecation window only;
- document Firebase backup, rules, and recovery.

### A-013 — Retention cleanup exists but is not scheduled at startup

**Priority:** P1  
**Status:** Confirmed by reference search

`cleanupService.js` implements cleanup and health state, but no backend startup path invokes or schedules it. Health reports cleanup status without proving periodic execution.

Impact:

- files can grow indefinitely;
- metadata retention deadlines do not guarantee deletion;
- operators may interpret health as active retention enforcement.

Recommended resolution:

- schedule cleanup with a single-instance lease or external scheduler;
- persist last start, last completion, deleted counts, and error;
- expose “never run” as degraded;
- add a manual admin operation with audit logging;
- test metadata and filesystem cleanup together.

### A-014 — Queue, live state, WebSocket subscriptions, and reservations are process-local

**Priority:** P1  
**Status:** Confirmed

The following are in memory:

- queue arrays/sets;
- cancellation flags;
- worker live state;
- WebSocket subscriptions;
- idempotency reservations.

Persisted jobs survive restart, but the platform does not automatically reclaim queued/running work. Horizontal backend replicas do not share execution ownership.

Impact:

- restart can leave orphaned active statuses;
- multiple replicas can exceed global concurrency;
- same-key requests can race across instances;
- WebSocket events reach only clients connected to the executing instance;
- local storage may not match metadata on another instance.

Recommended near-term contract:

- explicitly support one backend replica only;
- add startup reconciliation for nonterminal jobs;
- mark orphaned jobs failed/cancelled with a recovery reason.

Recommended long-term:

- persistent queue and distributed lease;
- shared event bus;
- shared object storage;
- database-enforced idempotency uniqueness.

### A-015 — Security boundary is implicit

**Priority:** P1  
**Status:** Requires deployment decision

Admin routes use JWT, but job creation, history, detail, download, cancellation, and re-ask routes are not authenticated. Firebase REST calls carry no service credential in this code.

This may be intentional for a network-restricted internal deployment, but that assumption is not expressed as an enforceable control.

Questions requiring an owner:

- Is access restricted by VPN, reverse proxy, SSO, or firewall?
- Are Firebase rules private to the backend?
- Should one user see/cancel/download another user’s job?
- Are Final PO and EPMS workbooks classified data?

Recommended resolution:

- write a threat model and data classification;
- require upstream identity or application authentication;
- add job ownership/role checks;
- use authenticated Firebase access or a server SDK;
- record download/cancel/rerun audit events;
- define encryption and retention requirements.

### A-016 — Frontend upload guidance differs from backend enforcement

**Priority:** P2  
**Status:** Confirmed

`UploadPanel.vue` defaults say:

```text
.xlsx, .xls, .csv
Maximum recommended size: 25 MB
```

Backend allows:

```text
.xlsx, .xls, .xlsm
MAX_UPLOAD_SIZE_MB default 100
```

Impact:

- CSV appears selectable but fails backend prevalidation;
- `.xlsm` is supported but not advertised;
- size guidance does not match enforcement.

Recommended resolution:

- return upload capabilities from backend or share one generated config;
- set component labels per upload kind;
- remove hard-coded 25 MB and extension defaults.

### A-017 — Auditor registry drift is fail-closed only when sibling source exists

**Priority:** P2  
**Status:** Confirmed

The auditor validates parity with `create-pr-cd` when the sibling registry file is available. If installed or executed standalone without it, local registry status becomes `NOT_AVAILABLE` and execution continues.

This is reasonable for portability but weaker than the wording “fails closed on registry drift.”

Recommended resolution:

- define two explicit modes:
  - production: source contract hash/pin required;
  - standalone development: local snapshot allowed with warning;
- embed the approved upstream registry SHA-256 in the local registry;
- report it in summary metadata.

### A-018 — Auditor accepts zero submitted quantity as a normal claim

**Priority:** P2  
**Status:** Business validation required

Quantity fallback returns `0.0` if submitted, settlement, and paid quantities are absent or unparsable. A valid item with zero submitted quantity consumes nothing and becomes `NORMAL_FULL`.

Questions:

- Should zero quantity be ignored?
- Should missing/unparseable quantity be Invalid or Review Required?
- Are negative quantities legitimate reversals?

Recommended resolution:

- distinguish missing, invalid, zero, positive, and negative quantities;
- introduce explicit reason codes;
- add Final PO quantity validation before matching.

### A-019 — Scope is inferred from free text and filenames

**Priority:** P2  
**Status:** Confirmed

ECC scope depends on filename tokens such as ` TSS PR `. Final PO scope depends on business-domain and description keywords. Unknown scope may still match; multiple scopes become Invalid Ambiguous Scope.

Recommended resolution:

- emit explicit scope in ECC sidecar/workbook metadata;
- map Final PO scope from an approved exact field/value registry;
- keep keyword inference only as a documented legacy fallback;
- preserve the resolution source and confidence in output evidence.

### A-020 — Subcontractor normalization contains embedded business aliases

**Priority:** P2  
**Status:** Confirmed

`normalize_subcontractor()` hard-codes legal-word removal and special handling for `GTSB`, `GCI`, and `ALLSTAR`. This logic is business-sensitive but lives in code rather than governed configuration.

Recommended resolution:

- move aliases to a versioned subcontractor registry;
- share identity keys with `create-pr-cd` contract mapping;
- reject ambiguous alias collisions;
- record raw, normalized, and matched registry key in audit evidence.

### A-021 — Documentation baseline and repository state are fragmented

**Priority:** P2  
**Status:** Confirmed

The repository contains current references, historical plans, autonomous-run logs, old architecture files, and older baseline commit labels. Some documents still reflect pre-Firebase or pre-official-entrypoint architecture.

Recommended resolution:

- make `DETAILS.md` the handover index;
- mark each document `Current`, `Historical`, or `Superseded`;
- add an owner and last-verified commit;
- archive stale implementation plans under a clear historical directory;
- repair encoding/rendering artifacts where found.

### A-022 — Admin asset UI remains while backend asset management is disabled

**Priority:** P3  
**Status:** Confirmed

Admin asset routes return empty lists or `ASSET_MANAGEMENT_DISABLED`, but the frontend retains asset views and navigation.

Recommended resolution:

- either remove/hide the asset UI;
- or present it explicitly as read-only engine pin information;
- do not suggest that PR Model/template assets can be uploaded or activated.

## 4. Recommended cleanup sequence

### Phase 0 — Restore an executable baseline

1. Resolve A-001 pin mismatch on a dedicated branch.
2. Run engine integrity.
3. Start backend and verify health.
4. Run focused MW and PR Auditor platform tests.

### Phase 1 — Protect correctness

1. Fix canonical review evidence handling (A-002).
2. Fix canonical output decision invariant (A-006).
3. Define per-scope required mapping semantics (A-007).
4. Decide existing-PR purpose behavior (A-008).
5. Preserve structured engine error codes (A-009).
6. Add full no-ECC and review-only integration tests.

### Phase 2 — Strengthen cross-engine contracts

1. Emit explicit ECC lineage and scope (A-004, A-019).
2. Version and hash the shared DU registry contract (A-003, A-017).
3. Replace hard-coded subcontractor aliases with a registry (A-020).
4. Clarify invalid/zero quantity rules (A-018).

### Phase 3 — Simplify platform structure

1. Remove execution-time platform workbook rewriting where possible (A-005).
2. Align actual auditor progress reporting (A-010).
3. Align frontend upload capability text (A-016).
4. remove or redefine admin asset UI (A-022).

### Phase 4 — Production operations

1. Add RAN integrity verification (A-011).
2. remove Mongo/Firebase deployment drift (A-012).
3. schedule and verify retention cleanup (A-013).
4. document single-instance constraints or build distributed execution (A-014).
5. implement the agreed security boundary (A-015).
6. consolidate documentation (A-021).

## 5. Definition of refined and clean

The architecture can be considered ready for stable handover when:

- every engine checkout, gitlink, manifest commit, and fingerprint agrees;
- backend starts from a clean recursive clone;
- all nine identities are labeled accurately as recognized/runnable/pending;
- every ECC file carries explicit scope and DU profile/View lineage;
- canonical classification and output decision cannot contradict each other;
- scope-required fields are actually scope-specific;
- standalone generation and audit-entitlement existing-PR behavior is explicit;
- all engine review evidence survives ingestion and packaging;
- stable engine error codes reach safe user diagnostics;
- zero-output tests cover ignored, duplicate, review-required, and true failure cases;
- deployment contains only the datastore actually used;
- cleanup execution and recovery are observable;
- runtime topology and security assumptions are enforced, not implicit;
- `DETAILS.md` and manifests are updated in the same release as contract changes.
