# Handover — reviewed 2026-10-15

## Current truth
- Source: `https://github.com/Gumb-D/iepms-pr-upload-automation`.
- Published platform baseline `ec5fd9b` pins uploader `397010e` v0.3.1 (XLS/XLSX).
- The inspected host runs an uncommitted v0.3.2 fix plus modified approval. It is NOT contained in the published gitlink. [Exact snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md).
- Platform adapter calls `submit_request`, not draft-only `prepare_request`. It validates, imports, attaches, submits and verifies, then stops before tracker/IP writes. Generic production run/resume must not be substituted casually.

## Latest live evidence
- W14 job `PR-20261015-015`: existing draft `PSQ202610150909` / `1000121288`; zero server lines; all 7 imported rows failed; NOT submitted. Preserve unresolved IMPORT_ECC intent and existing draft.
- W15 job `PR-20261015-016`: local validation rejected `details!P2`; no draft created by this attempt. Original unchanged.
- W16 job `PR-20261015-019`: `PSQ202610150919` / `1000121298`; submitted=true, verified=true; exit 0. Tracker/IP stages were not run. Original unchanged.

## Validation / installation
Use the actual backend Python (host checked: `C:\Python314\python.exe`; use a virtual environment where configured):

```powershell
python -m pip install -r skills/iepms-pr-upload-automation/requirements.txt
# In an isolated/offline test environment; tests may need pytest and test-only xlwt:
python -m pytest skills/iepms-pr-upload-automation/tests -q
npm.cmd --prefix backend run test:iepms-skill-offline
npm.cmd --prefix backend run test:engine-integrity
npm.cmd --prefix backend run test:skill-fingerprint
```

Run tests with network access blocked/mocked; these commands are not permission for live PR mutations. v0.3.1 validation recorded 182 Python and 95 frontend tests; local v0.3.2 recorded 236 offline Python tests. Backend integrity and unavailable-CDP regression passed after local deployment. W16 is evidence for the XLSX submit-only path; failed W14 does not demonstrate successful XLS import.

## Recovery / deployment
Launchers initialize exact pins, not branch heads. Commit/publish skill changes, pin them, update approval and install dependencies before a reproducible release. Backend restart reloads approval JSON; do not restart while jobs are active. Preserve recovery snapshots/ledgers and backend-host CDP auth; never export credentials into reports.

Original workbooks remain unchanged in the inspected host's Downloads. Investigation evidence is host-local, not committed wholesale: see [snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md). Next actions are in [PENDING.md](PENDING.md); no blind retry of known drafts or submitted PRs.

## Observed W14-W16 operations and recovery anchors

These are retained 2026-10-15 observations, not new server polling. Originals in `C:\Users\JJBorn\Downloads` were not edited. Default test config was CelcomDigi MW, planned start 2026-10-22, N/N, no separate attachment; scope/model vary below. Browser 19222, separate tagged tabs. No tracker/IP writes ran.

- **W14 original:** `Northern-GCI ZTE TX Mini TI PR 20261015.xls`,41,472 bytes, SHA256 `0895c485048cff37f9123b70821fa9c66aa5615c1a2bd150190b09b92914d736`. TI/ZTE TX MINI; site4021C_AD, DU00007130648,3 business rows2-4; SN-only rows5-8. Earlier job014 failed local v0.3.1 at Purchasing Area row5. Job015 with local v0.3.2 created draft `PSQ202610150909` / OID1000121288, execution `exec-a22be5341c8b4f5695e13a251e8aee02`; IMPORT_ECC intent unresolved. Server processed7/accepted0/failed7, no lines. Actual reason: 'Detailed entries with sites and those without sites cannot be added simultaneously'; padding also lacks contract and reports in-batch duplicates. Import status SUCCEEDED means processing completed, not accepted lines. Do not create a new PR, reset ledger, delete lines or re-import blindly. A separate cleaned import-copy proposal was not authorized/implemented.
- **W15 original:** `Sabah-Seri Pancar MW EOS Swap TI PR 20261015.xls`,41,472 bytes, SHA256 `4bc515707c2474e1d4a6844f8887d925f60f7bede8d1919f3a75806216499770`. TI/MW EOS Swap. Job016 failed local validation before external create/import at `details!P2`: cached#N/A in auxiliary Contract Number. Lookup cause and effect on required contract column remain unknown; business-row validation is incomplete. Downloadable safe JSON includes validationIssue; generic job error.details is empty. Do not suppress global Excel errors. No draft was created by this attempt.
- **W16 original:** `Central-GTSB ZTE TX MINI TSS PR 20261015.xlsx`,9,345 bytes, SHA256 `abe4c0454b7039bd58a728863fd86007ced2e6b2b8e11880cd7f9ddf0c4d3c75`. TSS/ZTE TX MINI;6 lines, sites B02781_AD_1 and B01872_EB; no serial padding/errors. Job019 / `PSQ202610150919` / OID1000121298, execution `exec-c627362047984198b3aa0e8ae9e25917`, completed12:54:37.777Z. Ledger reached ECC_IMPORTED/ATTACHMENT_VERIFIED/FINAL_SAVE_COMPLETED/SUBMITTED/COMPLETE, submitted=true, verified=true, exit0. Later detailed approval stage/amount was not separately verified. Do not submit again to recreate evidence.

Evidence filenames and host-local directory are in [deployment snapshot](DEPLOYMENT_SNAPSHOT_2026-10-15.md). Job engineCommit was null: observed version and inspected host source/approval are distinct evidence, not immutable deployment attestation.

## Supplied historical records from the other PC

The following are user-supplied latest-recorded observations, not fresh server checks. They are retained here for recovery/context, not as a recreated standalone workbook register. Exact workbook filenames and most header OIDs were not supplied; do not infer them from job suffixes.

- W01 `PSQ202609301036`: PSQ verified, detailed stage unknown.
- W02 `PSQ202609301085`: To be countersigned, MYR 702.81.
- W03 `PSQ202610010003`: unsubmitted draft; final save blocked by budget/exchange-rate errors.
- W04 `PSQ202610010007`: unsubmitted draft; saved with exchange-rate warning.
- W05 `PSQ202610010156`: To be countersigned, MYR 1493.45.
- W06 `PSQ202610010206`: To be countersigned, MYR 940.80.
- W07 `PSQ202610010380`: To be countersigned, MYR 1441.05.
- W08 `PSQ202610010390`: To be countersigned; submitted description says TX_2 although intended scope was TX_1. Correction/revocation is not authorized by these notes.
- W09 `PSQ202610010545`: To be countersigned, MYR 536.28.
- W10 `PSQ202610010641`: To be countersigned, MYR 1085.11.
- W11 `PSQ202610010654`: To be countersigned, MYR 2204.66.
- W12 Allstar ECC,6 lines/3 sites: draft `PSQ202610130023` / OID1000118081;0 import success/6failed, zero lines; not submitted, left untouched. Specific server row reasons not established here.
- W13 Magicell ECC,3lines/1siteQ01087_AD, DU00006931164: `PSQ202610130030` / OID1000118088; submitted and verified3lines, MYR 2293.74; last recorded To be countersigned.

Do not retry submitted PRs or equate historical draft existence with safe resubmission. Resolve business/data blockers from read-only server evidence before proposing narrowly authorized recovery.
