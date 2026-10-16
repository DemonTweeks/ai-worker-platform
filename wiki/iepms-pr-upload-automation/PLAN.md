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
