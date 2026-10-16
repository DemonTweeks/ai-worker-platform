# Create PR CD RAN - Skill contract

| Item | Declaration |
| --- | --- |
| Skill / release | `create-pr-cd-ran` / 1.1.2; pin `15fae20` |
| Schema / entrypoint | Input/result 1.0; `src/main.py --input-manifest` |
| Files | Exactly one `bom` XLSX and one `epms` XLSX; each max 100 MiB |
| Required parameter | `runMode`: `standard-pr` or `general-item` |
| Conditional parameter | `selectedProject`: required catalogue entry in General Item mode; ignored by standard mode |
| Timeout / progress | 3,600 seconds; NDJSON/30-second heartbeat |
| Cancellation | `temp/cancel.requested`, cooperative child supervision |

Unknown inputs/parameters, wrong checksums/sizes and unsafe paths fail validation. Runtime produces `result.json`, individual approved artifacts and `CREATE_PR_CD_RAN_DELIVERY.zip`, all with hashes; archive membership is checked. Summary metrics include `runMode`, `selectedProject`, `siteCount`, `outputFileCount`.

Public diagnostics are skill-owned but not proven universally sanitized: current wrapper includes `stderrTail`/`str(exc)` in some failures. See [Pending](PENDING.md) instead of assuming every technical detail stays private.
