# iEPMS upload 0.3.8: slow-server HTTP allowance

User-approved release: increase live uploader HTTP timeouts from 30 to 600 seconds.

- Shared `http_policy.py` sets HTTPX connect/read/write/pool inactivity limits to 600 seconds.
- All three owned clients use it: signed GET/JSON/multipart, signature bootstrap, FBR discovery.
- Explicit injected clients retain their configuration. No retry, mutation replay, ledger, CDP or credential changes.
- Runtime version 0.3.8 is consistent across manifest, Python package metadata and entrypoint.
- Approved normalized package SHA-256: `e1590838290e7e041abf16119b395e4eb31cb7e42b4cecfe55853ef2bdba02be`.
- Overall skill timeout remains 1,800 seconds. It can truncate a late request; 600 seconds is not a whole-request wall-clock guarantee.
- Original historical exception was not retained; this release does not claim it was a confirmed timeout.
- Existing successful recovery PSQ202611190767 / PR-20261119-017 must not be resubmitted as part of deployment.

Validation: 430 Python tests passed (45.45s), compileall and diff checks passed.
Platform generic skill contract, cross-platform fingerprint normalization and isolated offline XLS/XLSX integration passed.
The integration deliberately uses unavailable local CDP; no live corporate submission.

Deployment: fast-forward production to the released platform commit, update only the exact uploader gitlink,
validate every approved package, check no active/queued jobs, restart backend on port 8000 with production profile.
Frontend, environment secrets, database, retained inputs, outputs and runtime ledgers are unchanged.
Verify health, uploader catalog version/fingerprint, and actual production HTTP defaults after restart.
