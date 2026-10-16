# Architecture

```text
Manifest-driven Vue form
  -> multipart POST /api/skills/iepms-pr-upload-automation/jobs
  -> platform workspace + Firebase queue/machine lease
  -> python src/main.py --input-manifest skill-input.json
  -> submit_request(request, persistent_runtime_root)
  -> workbook/project validation + immutable snapshot + host worker lock
  -> authenticated Chrome -> signed Python API workflow
  -> create/reconcile draft -> ECC import -> verify lines/exceptions
  -> attachment/reviewers/save -> guarded Submit -> server-state verification
  -> stop before tracker and Implementation Plan stages
  -> PSQ + safe JSON/HTML report -> platform history/downloads
```

The desktop/CLI `prepare_request` is a distinct draft-only mode. Do not substitute generic production run/resume paths that can execute tracker/IP stages.

`IEPMS_PR_UPLOAD_RUNTIME_ROOT` is a persistent host-local recovery directory, defaulting to the skill's `runtime/jobs/wrapper`. All wrapper instances on a host must share it. Preserve immutable snapshots, cached results and SQLite ledgers independently of platform job retention. Unknown create/import outcomes must be reconciled against the existing PSQ before another mutation; never delete/reset state to force a replay.

The manifest disables running cancellation; queued cancellation is supported. Timeouts and host failures may still interrupt a mutation. The frontend uses manifest file/count/size checks, not ECC business validation.

Only allowlisted reports are public. Cookies, signing material, raw authenticated diagnostics, resume paths and ledgers remain private. Local v0.3.2 adds safe validation coordinates, but the platform job error projection currently drops nested validation details: download the safe report for the cell location.

See [published versus local runtime](DEPLOYMENT_SNAPSHOT_2026-10-15.md) and [pending work](PENDING.md).

## Files, state and cross-layer diagnosis

`src/main.py` is the platform transport adapter; `thin_wrapper.py::submit_request` owns immutable request binding/lock/snapshot; `application.py` chooses the workflow factory; `workflow/phase1.py` persists checkpoints/mutation intent; `golden_production_backend.py` and `production_session.py` adapt signed service calls. Standalone `prepare_request` is draft-only; generic production run/resume can include downstream tracker/IP stages and is not an interchangeable entrypoint.

The persistent runtime contains hashed request directories with `request.json`, `package/manifest.json`, original ECC/attachment snapshots, SQLite ledger and private `result.json`. SQLite executions/checkpoints/mutations preserve intent/completion boundaries; an incomplete IMPORT_ECC is uncertainty, not permission to resend. Keep whole runtime across restarts. Firebase job status, safe report and private external ledger answer different questions; one must not overwrite another to manufacture success.

Startup can appear quiet while authenticated bootstrap runs. Read job heartbeats and ledger safely; never expose cookie values/signature keys. Browser/CDP on host supplies identity; UI tab only supplies files/parameters. Source port probing may select a different Chrome instance if not configured.
