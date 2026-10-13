# Integration Plan

Implemented on `agent/add-iepms-pr-upload-skill`:

- Add the repository as a pinned submodule following `migration/zx01-pc`.
- Add `skill.json`, `requirements.txt`, and `src/main.py` inside the skill repository, delegating to its existing draft wrapper.
- Approve the complete Python runtime package, dependency declarations, and manifest by normalized SHA-256.
- Register the skill with the generic runner and catalog.
- Add navigation, dashboard link, hash route, file controls, date input, and manifest-declared PSQ fields.
- Display generic skill result fields in job history and detail.
- Respect the manifest's running-cancellation restriction atomically at queue claim boundaries.
- Preserve shared snapshots, worker locking, cached PSQs, and uncertain-state recovery.
- Test the standalone draft workflow, generic HTTP submission, actual Python execution with unavailable authentication, report downloads, and cancellation behavior offline.

Source layout:

```text
skills/iepms-pr-upload-automation/
  skill.json
  requirements.txt
  pyproject.toml
  src/main.py                         # platform contract adapter
  src/iepms_pr_upload/thin_wrapper.py # existing desktop/CLI wrapper
  src/iepms_pr_upload/workflow/       # existing business workflow
  tests/test_platform_contract.py
backend/scripts/iepms-skill-offline-test.js
wiki/iepms-pr-upload-automation/*.md
```

The skill contract is published at `f094cc1` on `migration/zx01-pc` and pinned by this integration. Remaining host validation is tracked in `PENDING.md`.
