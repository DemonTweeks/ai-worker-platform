# create-pr-cd Nizar Valid-Case Verification

## Document control

| Field | Value |
| --- | --- |
| Validation date | 2026-09-10 (Asia/Kuala_Lumpur) |
| Document recorded | 2026-10-02 (Asia/Kuala_Lumpur) |
| Subject | Compatibility and output-parity validation of the latest `create-pr-cd` against the supplied Nizar valid case |
| Input package | `C:\Users\ZteAdmin\Desktop\temp-workspace\nizar-pr-creator-valid-case` |
| Preserved artifacts | `C:\Development\ai-worker-platform\.tmp\nizar-valid-case-20260910` |
| Code changes made during validation | None |
| Commits made during validation | None |

This document preserves the original request, the reported result, the execution evidence, and the detailed findings. It is a validation record, not evidence that the findings have been fixed.

## Original request (verbatim)

~~~text
pull all latest first;

this is the valid case for create-pr-cd
C:\Users\ZteAdmin\Desktop\temp-workspace\nizar-pr-creator-valid-case

let me know result and findings
~~~

## Reported result (verbatim)

~~~markdown
Latest create-pr-cd does not fully reproduce the supplied valid case.

### Pull status

- create-pr-cd: latest `main` at `237ee81`
- tx-pr-auditor: latest `main` at `d95295a`
- Platform fetch completed, but local `repack/ai-worker-platform` is 6 commits ahead and 8 behind because the remote branch was force-updated. I did not overwrite those local commits.

### Valid-case results

| Project / scope | Expected sites | Generated | Review | Duplicate | Missing |
| --------------- | -------------- | --------- | ------ | --------- | ------- |
| TX Rollout TSS  | 1              | 0         | 1      | 0         | 0       |
| Jendela TSS     | 1              | 1         | 0      | 0         | 0       |
| Jendela TI      | 2              | 1         | 1      | 0         | 0       |
| TX Mini TSS     | 10             | 5         | 4      | 0         | 1       |
| TX Mini TI      | 6              | 3         | 3      | 0         | 0       |
| MW EOS TSS      | 6              | 6         | 0      | 0         | 0       |
| MW EOS TI       | 2              | 0         | 1      | 1         | 0       |
| **Total**       | **28**         | **16**    | **10** | **1**     | **1**   |

Key findings:

- `South Pacific` fails contract mapping because the approved mapping contains `South Pac`. This blocks `7333C` and four TX Mini sites.
- `W01033_Relocate1` exists in the reference output but is absent from the corresponding TX Mini input workbook.
- TI sites are blocked by missing antenna size, dismantling antenna size, or State data.
- `K00782-K00420` is blocked because an existing TI PR reference is present.
- TX Mini TI writes partial ECC rows for two `REVIEW_REQUIRED` sites. This conflicts with the documented whole-site/no-partial-output rule.
- Jendela TSS `8040R` changed from LOS 3-alternative PBOM `350000062776`, quantity `1.5`, to LOS 1-alternative `350000062773`, quantity `1`.
- MW EOS TSS `B02521-3262A` changed survey/design quantity from `1.5` to `1`.
- TX Rollout TSS all-sites mode fails terminal reconciliation: 316 sites become `RENDERER_SITE_UNACCOUNTED` after 205 workbooks were created. The wrapper correctly returns failure and exposes none of those files.
- All 38 targeted automated tests pass, meaning these real-data cases are currently missing from regression coverage.
- All 30 outputs formally declared by successful selected-site jobs passed file existence, size, and SHA-256 validation.
- PyYAML is required by the profile loader but missing from declared requirements. I installed it only in the local `.venv` for testing.
- Platform integrity currently fails because the platform fingerprints/pins do not approve the newly checked-out skill commits.

Artifacts are preserved under [nizar-valid-case-20260910](C:/Development/ai-worker-platform/.tmp/nizar-valid-case-20260910). No code fixes or commits were made.
~~~

## Validation snapshot

### Repositories and branches

The following state was captured during the validation run:

| Repository | Branch | Commit | Remote relationship |
| --- | --- | --- | --- |
| `ai-worker-platform` | `repack/ai-worker-platform` | `3bede20597701f6072e7daf2d78a5b2fd0368c6d` | 6 commits ahead and 8 behind `origin/repack/ai-worker-platform` after a remote force-update |
| `skills/create-pr-cd` | `main` | `237ee8175a2ee5b0ce05520e155b2da155001d6f` | Matched `origin/main` |
| `skills/tx-pr-auditor` | `main` | `d95295ad2c260791e40b09eb8145a3a0ee7d313b` | Matched `origin/main` |
| `skills/create-pr-cd-ran` | detached/pinned | `239910e2816153339a94881597bbb95355059741` | Fetched but not advanced because the top-level `.gitmodules` did not declare a branch |

The platform branch was not reset, rebased, or force-updated because doing so would have overwritten or rewritten six local-only commits. Existing local changes were preserved.

At validation time, the top-level platform gitlinks did not point to the checked-out latest skill commits. Updating the skill worktrees therefore made the platform report the submodules as modified.

### Preserved pre-existing local state

- `skills/create-pr-cd/Info/input/site_pr_po_view.xlsx` was already modified and was preserved.
- `skills/tx-pr-auditor/sample-input/` was already untracked and was preserved.
- `agent-guideline/` was already untracked on the validation branch and was preserved.

### Runtime

| Component | Version/status |
| --- | --- |
| Python | 3.13.2 |
| pandas | 3.0.3 |
| openpyxl | 3.1.5 |
| PyYAML | 6.0.3, installed into the repository-local `.venv` for this validation |
| xlrd | 2.0.2, installed into the repository-local `.venv` |
| create-pr-cd contract | `skillId=create-pr-cd`, version `4.0.0`, schema version `1.0` |

The formal entrypoint used for the contract runs was:

~~~powershell
C:\Development\ai-worker-platform\.venv\Scripts\python.exe `
  C:\Development\ai-worker-platform\skills\create-pr-cd\src\main.py `
  --input-manifest <isolated-workspace>\input.json
~~~

Each job used one workbook, one explicit scope, its own isolated workspace, and the production contract path used by AI Worker Platform. No `--non-production-uat` flag was supplied.

## Input inventory

Four source workbooks were present:

1. `A-P202202168750_D002-2023 TX Rollout-TX Rollout V2-20260910202825.xlsx`
2. `A-P202202168750_D002-Jendela TX Migration-Migration Rollout (TX)-20260910142806.xlsx`
3. `A-P202202168750_D002-TX Mini Project-TX Mini Project v12024- Nizar View-20260910142807.xlsx`
4. `A-P202211283695_D002-MW EOS Swap-MW EOS Swap Rollout - Nizar view-20260910144944.xlsx`

The supplied reference-output directory contained 14 workbooks:

| Reference workbook | Sites found in `details` | Data rows |
| --- | --- | ---: |
| `Central-GCI EOS Swap TSS PR 20260910.xls` | `B00280-B00278_1`, `W01333-1777B` | 4 |
| `Central-GCI TX Mini TSS PR 20260910.xls` | `W01033_Relocate1` | 2 |
| `Central-GTSB MW EOS Swap TI PR 20260910.xlsx` | `B02830-1423A` | 3 |
| `Central-GTSB MW EOS Swap TSS PR 20260910.xlsx` | `B02521-3262A`, `B02830-1423A` | 5 |
| `Eastern-GTSB Jendela TX Migration TI PR 20260910.xlsx` | `8040R`, `8376R` | 8 |
| `Eastern-GTSB Jendela TX Migration TSS PR 20260910.xlsx` | `8040R` | 3 |
| `Northern-GCI EOS Swap TI PR 20260910.xls` | `K00782-K00420` | 3 |
| `Northern-GCI EOS Swap TSS PR 20260910.xls` | `K00782-K00420` | 2 |
| `Northern-GCI TX Mini Project TI PR 20260910.xlsx` | `4592B_HU_1`, `4979B_AD`, `4979B_AD_2`, `4979B_AD_5`, `C01085_AD_1`, `K00691_AD` | 14 |
| `Northern-GCI TX Mini TSS PR 20260910.xls` | `4709A_AD`, `4979B_AD`, `4979B_AD_2`, `4979B_AD_5` | 5 |
| `Sabah-GTSB TX Mini Project TSS PR 20260910.xlsx` | `7647C_PORT` | 1 |
| `Sabah-South Pacific TX Mini TSS PR 20260910.xls` | `7014A_PORT`, `7405A_PORT`, `7523A_PORT`, `7946A_PORT` | 4 |
| `Sabah-South Pacific TX Rollout TSS PR 20260910.xls` | `7333C` | 2 |
| `Sarawak-YPTT MW EOS Swap TSS PR 20260910.xlsx` | `9538B-9367A` | 2 |

The reference set therefore represented 28 site/scope selections and 58 ECC data rows.

## Test method

Two levels of testing were performed.

### Level 1: all-sites production matrix

Each input workbook was executed for TSS and TI using `allSites=true`, producing eight runs. This tested profile resolution, canonical conversion, required-field validation, eligibility and duplicate gates, renderer behavior, terminal reconciliation, result packaging, and the contract result.

### Level 2: reference-selected production jobs

Site IDs were extracted from the supplied reference output files. Seven jobs matching the reference project/scope combinations were then executed with explicit `siteCodes`. This tested whether the current engine could reproduce the supplied known-good business output instead of merely exiting successfully.

Output comparison used the `details` sheet, dynamically located the `Site ID*` header, and compared:

- site coverage;
- row counts;
- all 16 output columns;
- core business columns excluding presentation/duplicate helper fields (`SN.`, `Logical Site Name`, `Unnamed: 14`, and `Contract Number`);
- declared output existence, byte size, and SHA-256.

## All-sites production matrix results

| Input / scope | Contract status | Requested | Generated | Review required | Approved ignored | Duplicate blocked | Failed | Unaccounted | Created ECC workbooks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TX Rollout / TSS | `failed` | 21,838 | 5,295 | 2,648 | 13,579 | 0 | 316 | 0 | 205 created before terminal failure |
| TX Rollout / TI | `succeeded_with_warning` | 21,838 | 206 | 4,135 | 11,276 | 6,221 | 0 | 0 | 20 declared workbooks |
| Jendela / TSS | `succeeded_with_warning` | 272 | 19 | 1 | 252 | 0 | 0 | 0 | 8 |
| Jendela / TI | `succeeded_with_warning` | 272 | 29 | 31 | 1 | 211 | 0 | 0 | 11 |
| TX Mini / TSS | `succeeded_with_warning` | 3,302 | 2,363 | 162 | 777 | 0 | 0 | 0 | 106 |
| TX Mini / TI | `succeeded_with_warning` | 3,302 | 85 | 157 | 994 | 2,066 | 0 | 0 | 15 |
| MW EOS / TSS | `succeeded_with_warning` | 589 | 529 | 29 | 31 | 0 | 0 | 0 | 28 |
| MW EOS / TI | `succeeded_with_warning` | 589 | 0 | 34 | 103 | 452 | 0 | 0 | 2 |

### TX Rollout TSS terminal failure

The engine generated 205 ECC workbooks and 10,023 ECC rows, but final reconciliation rejected the run:

| Field | Value |
| --- | --- |
| Error code from domain runtime | `PR_SITE_RECONCILIATION_FAILED` |
| Public contract error | `CREATE_PR_FAILED` |
| Failed terminal sites | 316 |
| Unaccounted sites | 0 |
| Failed reason | `RENDERER_SITE_UNACCOUNTED` |
| Contract outputs exposed | 0 |

Examples included `A00341`, `A00778_RELOCATE1`, `Q00194_RELOCATE1`, `B01125`, and many other ordinary and relocation identities. Relocation rendering canonicalizes identities such as `A00778_RELOCATE1` to `A00778_Relocate`; however, no generated, review, or duplicate evidence was found for the failed candidates.

The wrapper behaved fail-closed: although renderer artifacts existed in the isolated workspace, `result.json` declared no outputs and the delivery archive was not exposed.

## Reference-selected job results

| Project / scope | Expected sites | Generated | Review required | Duplicate blocked | Missing from canonical input | Contract outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| TX Rollout TSS | 1 | 0 | 1 | 0 | 0 | `succeeded_with_warning` |
| Jendela TSS | 1 | 1 | 0 | 0 | 0 | `succeeded` |
| Jendela TI | 2 | 1 | 1 | 0 | 0 | `succeeded_with_warning` |
| TX Mini TSS | 10 | 5 | 4 | 0 | 1 | Initial exact request failed; existing-site rerun returned `succeeded_with_warning` |
| TX Mini TI | 6 | 3 | 3 | 0 | 0 | `succeeded_with_warning` |
| MW EOS TSS | 6 | 6 | 0 | 0 | 0 | `succeeded` |
| MW EOS TI | 2 | 0 | 1 | 1 | 0 | `succeeded_with_warning` |
| **Total** | **28** | **16** | **10** | **1** | **1** | Not reference-equivalent |

An exit code of zero was not treated as output parity. `succeeded_with_warning` often meant that requested reference sites did not receive an ECC result.

## Site-level terminal findings

### Contract mapping mismatch: `South Pacific` versus `South Pac`

The canonical input uses subcontractor `South Pacific`, while `Info/input/contract_info_reference.md` contains:

~~~text
| South Pac | S1MY2024071022WBF1 | SOUTH PACIFIC COMMUNICATIONS RESOURCES SDN.BHD |
~~~

`normalize_subcontractor()` trims whitespace and compares case-insensitively, but it does not resolve aliases. `SOUTH PACIFIC` therefore does not match `SOUTH PAC`.

The following expected sites were classified `REVIEW_REQUIRED / CONTRACT_MAPPING_NOT_FOUND` and produced no reference-equivalent ECC:

| Site | Project/scope | Tx SOW |
| --- | --- | --- |
| `7333C` | TX Rollout TSS | `MW PARALLEL LINK` |
| `7014A_PORT` | TX Mini TSS | `MW RE-ENGINEERING` |
| `7405A_PORT` | TX Mini TSS | `BBU PATCHING` |
| `7523A_PORT` | TX Mini TSS | `MW IDU PATCHING` |
| `7946A_PORT` | TX Mini TSS | `BBU PATCHING` |

Required action emitted by the engine: “Provide and approve the subcontractor contract number before PR generation.”

### Reference site absent from input

`W01033_Relocate1` exists in `Central-GCI TX Mini TSS PR 20260910.xls`, but no `W01033` value exists in the corresponding TX Mini source workbook. The exact selected-site contract request failed with:

| Field | Value |
| --- | --- |
| Error code | `SITE_CODES_NOT_FOUND` |
| Missing normalized site | `W01033_RELOCATE1` |
| Message | `Requested site codes were not found in the canonical input.` |

This means the reference output and source workbook are not a fully self-consistent snapshot for that site.

### Jendela TI

| Site | Disposition | Reason |
| --- | --- | --- |
| `8376R` | `GENERATED` | Two Starlink line items generated and matched the corresponding reference rows |
| `8040R` | `REVIEW_REQUIRED` | `MISSING_TI_ANTENNA_SIZE`; no TI ECC rows generated |

For `8040R`, the review report states that there is insufficient TI antenna-size information to select the mandatory antenna PR item.

### TX Mini TI

| Site | Disposition | Reason/effect |
| --- | --- | --- |
| `4979B_AD` | `GENERATED` | Reference IDU-patching row reproduced |
| `4979B_AD_2` | `GENERATED` | Reference IDU-patching row reproduced |
| `4979B_AD_5` | `GENERATED` | Reference IDU-patching row reproduced |
| `4592B_HU_1` | `REVIEW_REQUIRED` | `MISSING_TI_ANTENNA_SIZE`; no ECC row generated |
| `K00691_AD` | `REVIEW_REQUIRED` | `MW_REROUTE_DECOM_ANTENNA_SIZE_MISSING`; one partial ECC row was still written with `Remarks=REVIEW_REQUIRED` |
| `C01085_AD_1` | `REVIEW_REQUIRED` | `MW_REROUTE_DECOM_ANTENNA_SIZE_MISSING`; one partial ECC row was still written with `Remarks=REVIEW_REQUIRED` |

The runtime reconciliation code explicitly gives `REVIEW_REQUIRED` precedence over `GENERATED` when both ECC and review evidence exist. That permits partial renderer output. The skill documentation separately says blocked sites must not leak partial ECC rows and applies whole-site blocking. This is a policy/implementation contradiction requiring an explicit business ruling.

### MW EOS TI

| Site | Disposition | Reason |
| --- | --- | --- |
| `B02830-1423A` | `REVIEW_REQUIRED` | `MISSING_STATE`; route resolver could not determine the outbound route bucket |
| `K00782-K00420` | `DUPLICATE_BLOCKED` | `EXISTING_PR_REFERENCE`; the current input already contains an existing TI PR reference |

No MW EOS TI ECC workbook was declared for the selected reference sites.

## Output-parity findings

### Outputs with matching core business content

The following reference groups reproduced the same core business rows for their generated sites. Some non-core/presentation cells differed because the current renderer populated `Logical Site Name`, repeated `Contract Number`, or normalized source Tx SOW casing more consistently.

- Central-GCI MW EOS TSS: `B00280-B00278_1`, `W01333-1777B`
- Northern-GCI MW EOS TSS: `K00782-K00420`
- Sarawak-YPTT MW EOS TSS: `9538B-9367A`
- Northern-GCI TX Mini TSS: `4709A_AD`, `4979B_AD`, `4979B_AD_2`, `4979B_AD_5`
- Sabah-GTSB TX Mini TSS: `7647C_PORT`
- Jendela TI site `8376R` only
- TX Mini TI generated sites `4979B_AD`, `4979B_AD_2`, and `4979B_AD_5`

### Jendela TSS business-rule difference

For `8040R`, the reference output and current output both contained three rows, but the model selection and quantities changed:

| Item | Reference output | Current output |
| --- | --- | --- |
| LOS PBOM | `350000062776` | `350000062773` |
| LOS description | `MW LOS survey（3 alternative site）` | `MW LOS survey（1 alternative site）` |
| Technical survey quantity | `1.5` | `1` |
| Installation design quantity | `1.5` | `1` |

### MW EOS TSS quantity difference

For `B02521-3262A`:

| PBOM | Description | Reference quantity | Current quantity |
| --- | --- | ---: | ---: |
| `350000589343` | MW technical site survey | 1.5 | 1 |
| `350000589344` | MW installation design | 1.5 | 1 |

The LOS item `350000062773` remained quantity 1.

### Missing or incomplete reference groups

- No TX Rollout TSS ECC was produced for `7333C` because of the South Pacific contract alias mismatch.
- No TX Mini TSS ECC was produced for the four South Pacific sites.
- No TX Mini TSS ECC could be requested for `W01033_Relocate1` because it is absent from the source workbook.
- Jendela TI output omitted `8040R`.
- TX Mini TI output omitted `4592B_HU_1` and emitted only partial rows for `K00691_AD` and `C01085_AD_1`.
- No MW EOS TI ECC was produced for the two reference sites.

## Output-contract verification

For outputs formally declared by successful selected-site jobs:

| Check | Result |
| --- | --- |
| Declared output items checked | 30 |
| Missing files | 0 |
| Size mismatches | 0 |
| SHA-256 mismatches | 0 |

This validates the packaging contract for files that the engine chose to declare. It does not establish business parity with the 14 supplied reference workbooks.

## Automated regression verification

The following targeted suites were run:

~~~powershell
python -m unittest `
  tests.test_skill_contract `
  tests.test_create_pr_entrypoint `
  tests.test_issue_93_site_selection `
  tests.test_issue_74_reconciliation
~~~

Result:

~~~text
Ran 38 tests in 45.280s

OK
~~~

The passing automated suite did not detect the real-workbook South Pacific alias mismatch, selected-site output differences, partial TI ECC behavior, or TX Rollout all-sites reconciliation failure. These valid-case scenarios therefore need dedicated regression fixtures before the behavior can be considered protected.

## Dependency packaging finding

The initial runtime dependency check failed because `yaml` was unavailable:

~~~text
ModuleNotFoundError: No module named 'yaml'
~~~

`create-pr-cd` profile loading supports YAML through PyYAML, and the current DU profiles use YAML syntax. However:

- `requirements-worker.txt` declared pandas and openpyxl only;
- `skills/create-pr-cd/requirements.txt` declared pandas, openpyxl, and xlrd;
- neither declared PyYAML.

PyYAML 6.0.3 had to be installed explicitly in the repository-local `.venv` for the production entrypoint to execute. This is a deployment reproducibility gap.

## Platform integrity finding

After checking out the latest skill `main` commits without updating the platform approval manifest, the platform integrity test failed:

~~~text
ENGINE_FINGERPRINT_MISMATCH
MW PR Worker runtime files do not match the approved fingerprint.
~~~

Captured fingerprint details:

| Field | Value |
| --- | --- |
| Expected fingerprint | `c757c532a0f3ceee322bdb1d200fe61e0991cbfd0fdc582ea3c8e7317e715e61` |
| Actual fingerprint | `45b7f8dd978fd7902d32e3f70fad5a765fe1bd49a2058f578b298181fa0ca0d0` |

This was expected because the platform gitlink and approved fingerprint had not been updated as part of the read-only validation. Production promotion requires a coordinated update of:

1. the platform submodule gitlink;
2. the approved engine commit;
3. the approved runtime fingerprint;
4. the platform integrity tests.

## Preserved evidence

All validation workspaces were retained at:

~~~text
C:\Development\ai-worker-platform\.tmp\nizar-valid-case-20260910
~~~

Important locations:

| Evidence | Path |
| --- | --- |
| All-sites run workspaces | `.tmp\nizar-valid-case-20260910\runs` |
| Reference-selected run workspaces | `.tmp\nizar-valid-case-20260910\selected-runs` |
| Contract manifest templates | `.tmp\nizar-valid-case-20260910\templates` |
| Output comparison utility | `.tmp\nizar-valid-case-20260910\compare_outputs.py` |
| TX Rollout TSS failed result | `.tmp\nizar-valid-case-20260910\runs\case-1-tss\result.json` |
| TX Rollout TSS domain stderr | `.tmp\nizar-valid-case-20260910\runs\case-1-tss\temp\create-pr.stderr.log` |
| Exact TX Mini TSS missing-site result | `.tmp\nizar-valid-case-20260910\selected-runs\selected-3-tss\result.json` |
| Existing-site TX Mini TSS rerun | `.tmp\nizar-valid-case-20260910\selected-runs\selected-3-tss-existing` |

Each successful workspace contains its `input.json`, copied `input/site_data.xlsx`, `result.json`, domain stdout/stderr logs, output summary, review/duplicate reports where applicable, ECC workbooks, and delivery ZIP.

## Required decisions before fixes

1. Approve whether `South Pacific` is an alias of the governed `South Pac` contract identity or whether the contract reference itself must be renamed.
2. Confirm whether reference output or current profile rules are authoritative for Jendela LOS alternative count and 1.5 quantities.
3. Confirm whether reference output or current profile rules are authoritative for MW EOS survey/design quantity 1.5 versus 1.
4. Resolve the policy contradiction for TI sites that have both partial ECC and `REVIEW_REQUIRED` evidence.
5. Decide whether an existing TI PR reference must always block regeneration, including parity/replay cases.
6. Establish the correct source workbook for `W01033_Relocate1` or remove the stale reference output from this case.
7. Add this real-data case, or safely minimized fixtures derived from it, to regression coverage.
8. Add PyYAML to the governed runtime requirements.
9. Update platform gitlinks and fingerprints only after the business/output fixes are approved and verified.

## Final conclusion

The latest `create-pr-cd` contract and packaging mechanics work for many generated outputs, and their declared files are internally valid. The supplied Nizar package is not fully reproducible with the tested engine revision. The blockers include one reference/input inconsistency, one subcontractor alias mismatch, several fail-closed TI validations, business-rule differences in PBOM/quantity selection, a partial-output policy contradiction, a large TX Rollout reconciliation failure, an undeclared Python dependency, and platform fingerprint drift.

No fixes, platform pin changes, fingerprint changes, commits, or pushes were performed as part of this validation.
