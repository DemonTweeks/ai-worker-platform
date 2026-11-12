# MW EOS mapping release
User authorized commit, push and restart. MW 4.1.2 fixes exact antenna and coordinates; Auditor 1.2.2 explicitly supports the dependency. No pricing, quantity, route or audit arithmetic changed. Tests: MW 296 (294 passed/2 skipped), Auditor 44 passed, composite TSS/TI and tamper gates passed, isolated generic MW runner 2 generated/0 review. Frontend build passed; full backend regression in progress. No production rerun/iEPMS submission. Previous job results remain immutable.

Publication: MW 3485c4186db616af0ca5817d4b2a332683e5034b and Auditor 8934dd5a3c7a4e8c13555ded94d3c3de162145b5 pushed normally to main. Frontend 126 tests/21 files, build and 15 route smokes passed. Pre-restart queue 0/0; backend/database OK; unrelated Agnes HTTP 403 predates this release. Platform final SQLite regressions remain a pre-activation gate.

Final backend regression passed (283.7s), including Firebase-mock and SQLite worker persistence, composite Auditor dependency checks, cancellation, timeouts, downloads and BOM managed-input regressions. All release gates passed. Restart guarded by queue-idle check.
