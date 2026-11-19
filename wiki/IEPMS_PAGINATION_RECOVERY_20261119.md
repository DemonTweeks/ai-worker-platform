# iEPMS 0.3.9: consistent duplicate precheck and safe recovery

Authorized fix and sequential reruns for PR-20261119-019 / -020, identical Central-GTSB workbook and execution.
Original -018 error: PR list duplicate precheck read 39498 rows but total is 39497. This was not a timeout.

- Three bounded full scans; same totals, exact page row counts, unique OIDs required. No partial scan accepted.
- Narrow historical cache recovery only with immutable hashes, matching ACTIVE identity and empty checkpoint/mutation ledger.
- Preserve original runtime result; never delete execution history, bypass server duplicate checks or retry writes.
- Portal exposes safe pagination-specific diagnostic on exhaustion. Success retains existing verified PSQ fields.
- Preserve 600s HTTP inactivity allowance, 1800s overall execution budget and all other skill pins.
- 447 Python tests; platform generic contract, fingerprint normalization and offline XLS/XLSX integration passed.
- Approved package SHA256: 43541a947ef2655bb18072c9353ed1c3202963535b4abbe5d24cf262585d289b.

Production evidence and pre-recovery SQLite backup retained in conversation folder pagination-recovery-019-020.
Rerun first source to verified completion, then second source; exact-input second run must return cached success without another submission.
