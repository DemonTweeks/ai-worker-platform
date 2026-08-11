# create-pr-cd — Implementation Plan

## Completed Contract Work

- Added `skill.json` version `4.0.0`.
- Added `src/main.py --input-manifest`.
- Kept all domain modules and assets inside the skill.
- Made `site_data` the only public file input; PR model, template, mapping, profiles, and policies remain package-owned.
- Added TSS/TI, all-sites/site-code, and non-production UAT parameters.
- Added safe path, size, and checksum validation.
- Added NDJSON phases and a 30-second heartbeat.
- Added cooperative cancellation by supervising the existing CLI as a child process.
- Added authoritative `result.json`, output checksums, warnings, and requested-site reconciliation.
- Added standalone contract tests and preserved baseline/promotion/golden tests.
- Approved the package through one version-plus-runtime SHA gate in the platform.

## Current Layout

```text
create-pr-cd/
|-- skill.json
|-- src/main.py
|-- scripts/create_pr.py
|-- scripts/create_pr_impl.py
|-- config/pr_model_baseline.yaml
|-- Info/input/
`-- tests/test_skill_contract.py
```

## Release Rules

1. Domain and golden tests pass.
2. The PR-model baseline SHA passes independently of package approval.
3. Contract tests pass standalone.
4. Platform approved package fingerprint matches all declared runtime files.
5. Reconciliation has zero unaccounted or failed engine outcomes before success.

The platform's rollback-only MW path has been removed. No current TSS/TI contract work remains.
