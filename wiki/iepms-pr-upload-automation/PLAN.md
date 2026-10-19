# Integration and Release Plan

## Delivered
- Generic manifest-driven platform API, UI, queue, Python runner and safe output contract.
- Guarded submit-and-verify operation, stopping before tracker/IP changes; separate desktop preparation mode retained.
- Published native XLS/XLSX support v0.3.1 at `397010e`, platform integration `1822f2d`.
- Platform baseline `ec5fd9b` adds MW generator v4.0.1 (`dc7cb77`), independent of uploader fixes.
- W16 real XLSX import, attachment, Submit and verification succeeded (`PSQ202610150919`).

## Local implementation, not released
- Working-tree v0.3.2 shared padding policy and safe validation-coordinate reporting.
- Tested offline (236 Python tests reported for that fix; backend integrity/no-auth regressions passed). These counts are dated validation evidence, not a claim that every current platform suite was rerun.
- W14 passed local validation but server import rejected original padding; W15 failed safely at P2.

## Next gates
Publish/re-pin runtime changes separately, resolve server-import padding without altering originals or bypassing recovery, inspect W15, and propagate safe details into the platform UI. See [pending items](PENDING.md) and [snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).


## Additional model implementation — 2026-10-16

Local unreleased v0.3.3 adds `2024 Celcomdigi BAU`, `Celcomdigi USP` and `Jendela TX Migration` to Malaysia CelcomDigi Project only. See [contract and release boundary](SKILL_CONTRACT.md#additional-du-models--local-v033-2026-10-16). Existing models, submit-only limits and workbook validations are preserved. No commit, push, restart or live new-model submission was performed for this implementation. Historical v0.3.2 deployment observations below/above remain dated evidence, not the current working-tree version.


## Release update — v0.3.3 (2026-10-16)

Uploader v0.3.3 is now published on main at `93f303825fd03094e15019ded55b479633197292`. The accompanying platform release pins that exact commit and approves runtime fingerprint `0148ae1bba4eaedf41a509f3906cd115797dc707b677ba51772e55eefa5f1c83`. This supersedes earlier descriptions of v0.3.2/v0.3.3 as uncommitted local changes; dated live observations and unresolved W14/W15 blockers remain historical evidence and are not cleared by publishing.

The release includes the three new Malaysia CelcomDigi DU options and earlier safe row-validation/reporting fixes. Restart and inspect `/api/skills` for v0.3.3 and all seven models before claiming activation. No live new-model PR, tracker update or Implementation Plan write is part of this release.
