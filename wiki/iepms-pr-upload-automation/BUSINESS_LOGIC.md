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

## Local reader policy and attachment identity

Published v0.3.1 uses xlrd for genuine binary XLS and openpyxl for XLSX; it validates actual format, not renaming. Both use cached formula results and do not recalculate. Numeric integral identifiers are normalized; text leading zeroes remain text. Error cells and boolean identifiers are rejected, including unknown/auxiliary columns.

Local uncommitted v0.3.2 centralizes `ecc_rows.business_rows`: blank rows are skipped, positive-integer serial-only rows are ignored only as a trailing suffix, internal padding followed by business data fails, and non-SN content (even unknown/unlabelled columns) makes a business row. Required columns/types/positive finite quantities remain checked; quantity>1 requires Remarks, with the existing adjacent-unlabelled-column fallback. Original Excel coordinates remain in errors. All cells are read before filtering, so padding does not hide Excel errors. Manifest generation, batch counting and abnormal-quantity Remarks use the same policy.

No normalization/import copy was implemented: attachment and import both use original bytes. W14 proves this distinction matters. Any future derived import copy needs explicit provenance, business-row equivalence, hashes, original evidence attachment and safe recovery of the existing draft; it cannot be introduced as an invisible filename change.

## Submit gates and external-state safety

Create/recover exact draft identity -> import and verify actual server rows -> compare lines/exceptions -> governed correction/remediation only -> attach and verify expected evidence -> configure reviewer context -> validate fresh amount/currency, duplicate/abnormal categories and identity -> final save -> Submit -> verify submitted server status. `FINAL_SAVE_COMPLETED` and Submit intent affect recovery; do not repeat already-completed mutation stages blindly.

Unresolved exception categories, bad amount/currency, reviewer mismatch, import failedRowsNum>0, unknown mutation outcome or identity mismatch block Submit. The code contains governed duplicate remediation; this is not permission for operators to delete arbitrary lines or bypass business conflicts. Platform submit-only returns before tracker/IP stages. A PSQ, draft save, HTTP200 or import processing SUCCEEDED alone is not business success.
