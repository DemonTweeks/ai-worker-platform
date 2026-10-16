# create-pr-cd â€” Skill Contract

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `create-pr-cd` |
| Version | `4.0.1` |
| Entrypoint | `src/main.py` |
| Manifest schema | `1.0` |
| Result contract | `1.0` |
| Timeout | 3,600 seconds |
| Cancellation | `control/cancel.requested` plus supervised child termination |

## Input

File declaration:

- `site_data`: exactly one `.xlsx`, maximum 100 MiB.

Parameters:

- `scope`: required `TSS` or `TI`.
- `allSites`: boolean.
- `siteCodes`: unique string array.
- `nonProductionUat`: boolean.

Exactly one of `allSites=true` or a non-empty `siteCodes` list is required.

PR-model, template, mapping, profile, and policy overrides are not public inputs.

## Output

`result.json` declares every generated ECC workbook, domain report, and `CREATE_PR_DELIVERY_<scope>.zip`. It includes safe summary metrics, exact selected source Site IDs with their terminal dispositions, and the standard reconciliation counts:

```text
requested = generated + review-required + approved-ignored
          + duplicate-blocked + failed + unaccounted
```

Review, ignore, or duplicate outcomes produce `succeeded_with_warning`. Failed or unaccounted engine outcomes cannot produce success.

The delivery ZIP is created by the standalone Python skill. The Node platform does not compose or reinterpret it.

## Standalone Command

```text
python src/main.py --input-manifest <workspace>/input.json
```

The shared rules in [../SKILL_CONTRACT.md](../SKILL_CONTRACT.md) also apply.

Cancellation path precedence: platform-generated `paths.cancellation` overrides standalone defaults. Current generic platform jobs use `temp/cancel.requested`; MW/auditor manifest fallback `control/cancel.requested` does not override that envelope. Sources: `genericSkillRunner.js`, `genericSkillJobService.js`, and each Python `load_envelope`.
