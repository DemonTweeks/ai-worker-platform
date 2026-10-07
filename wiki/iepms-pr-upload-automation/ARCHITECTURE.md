# Architecture

```text
Manifest-driven Vue form
  -> multipart POST /api/skills/iepms-pr-upload-automation/jobs
  -> platform workspace + Firebase queue/machine lease
  -> python src/main.py --input-manifest skill-input.json
  -> existing prepare_request(request, persistent_runtime_root)
  -> workbook/project validation + immutable snapshot + host worker lock
  -> authenticated Chrome session -> existing signed Python API workflow
  -> Step 20 verified draft / blocked outcome
  -> PSQ + safe JSON/HTML report -> platform history/downloads
```

The existing desktop form, CLI, and platform adapter use the same `prepare_request` function. The platform does not reconstruct signing, API payloads, reviewer selection, ECC parsing, or the execution sequence.

`IEPMS_PR_UPLOAD_RUNTIME_ROOT` identifies a persistent, host-local recovery directory. It defaults to the skill's `runtime/jobs/wrapper`, matching the desktop launcher's default. Every wrapper instance must use the same root to share the lock and cached executions. Frozen inputs and ledger state survive platform job retention; do not remove them while an external draft may need recovery.

Equivalent frozen requests return the same cached verified PSQ across platform jobs. Auth-paused requests can resume the same execution. Ambiguous mutations retain the known PSQ and remain blocked rather than replaying an uncertain create/import operation.

The contract declares `supportsCancellation=false`. Queued cancellation remains available; cancellation after lease claim returns `SKILL_CANCELLATION_UNSUPPORTED`. A process timeout or host failure still interrupts execution, so the retained ledger must be reviewed before recovery. This integration requires the backend host's browser; it cannot consume the frontend user's browser session on a different machine.

Only safe report fields are published. Browser cookies, signatures, raw network diagnostics, local resume paths, and the SQLite ledger are not downloadable artifacts.
