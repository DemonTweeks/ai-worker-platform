# Business Logic

Business rules belong to the skill, not Node/Vue.

1. Read ECC `details` with xlrd for XLS or openpyxl for XLSX; validate required purchasing-area, region, site, DU, contract, vendor, PBOM, SOW, unit and positive quantity.
2. Validate project/DU/scope/date. Malaysia CelcomDigi supports 2023 TX Rollout and TX Mini Project; CelcomDigi MW supports MW EOS Swap and ZTE TX MINI.
3. Bind file hashes and settings into an immutable snapshot and share the persistent worker lock/ledger.
4. Bootstrap authenticated backend-host Chrome and signed API transport.
5. Create/reconcile draft, import ECC, verify server rows/exceptions, execute only governed remediation, attach evidence, configure reviewers and save.
6. Pass the fresh pre-submit gate, Submit, verify server state, then stop before trackers/IP. A PSQ alone is not completion.

Local v0.3.2 ignores blank and trailing serial-only template rows in shared local parsing, rejects internal serial-only and partial business rows, and preserves Excel row numbers. It still rejects Excel error cells, including auxiliary P2. Neither reader recalculates formulas.

Crucially, original ECC bytes are sent to iEPMS. W14 proves that local padding exclusion does not remove those rows from the server import. Server processing status SUCCEEDED is not business success: 7 failed rows and zero lines blocked Submit. No cleaned import copy or blind replay is authorized by a documentation update. See [pending items](PENDING.md).
