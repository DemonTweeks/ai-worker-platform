# West Malaysia region authority and warehouse defaults — 2026-11-19

## Approved rule
- Central, Northern, Southern and Eastern use the exact approved iEPMS Region source. Coordinates are not used to choose or override these regions.
- Central selects the confirmed KV region codes directly, including when State is absent: warehouse-to-site 350000214911; site-to-warehouse Simple Packing 350000589232.
- Northern/Eastern/Southern retain original iEPMS Province/State solely to choose a state-specific material code. Missing, ambiguous or unsupported material evidence remains review-required; do not infer State from coordinates.
- Northern packing returns default to **KV warehouse**; Eastern packing returns default to **KV warehouse**. This is the current business default, not an immutable rule.
- Sabah/Sarawak keep existing latitude/longitude boundary and district verification; no Lawas exception is newly approved.

## Configuration
`config/west_malaysia_routing_policy.json` is integrity-covered by the platform approval. `packing_defaults.northern.default_warehouse` and `packing_defaults.eastern.default_warehouse` can later be changed to a named warehouse already present in the state routes, after business approval, testing and a new package approval. There is no first-choice or silent alternate-warehouse fallback. Existing state-specific alternatives were copied exactly from the checked-in PR model decision pack. The older geography skeleton remains incomplete for other unresolved cases.

Northern KV return codes: Perlis 350000589241, Kedah 350000589242, Penang 350000589243, Perak 350000589244.
Eastern KV return codes: Pahang 350000589272, Terengganu 350000589273, Kelantan 350000589274.

EOS State now maps only exact Site Basic Info / Site Basic Info / Province/State / site|fix00008. Strict source header governance and duplicate physical-column rejection are unchanged. West coordinate raw values remain in evidence, marked not used; malformed coordinates cannot fail decimal conversion for these four approved regions. Other regions retain existing conversion and geography checks.

## Diagnosis and isolated acceptance
PR-20261119-028, MW EOS Swap TI 4.1.2: 32 selected, 2 Sarawak generated, 30 MISSING_STATE reviews (12 Central, 17 Northern, 1 Eastern). Original State was populated for all 32; EOS optional State mapping had no source candidates.
Local validation with MW 4.1.3 against a copied original workbook generated **32/32**, review/failed/unaccounted **0**, seven ECC workbooks plus summary/archive. Both Sarawak ECC workbooks have identical cell values to the original job. Source workbook unchanged. Workspace and evidence retained under the AIDA conversation folder `region-028-offline-validation` and `region-028-*.log/json`.
No production job rerun, iEPMS draft, upload or submission is part of this release. Existing submitted Sarawak results must not be duplicated.

## Platform and Auditor
MW 4.1.3 is explicitly supported by Auditor 1.2.3, retaining previous supported versions and the same DU registry contract. Uploader/RAN/TX BOM pins unchanged.
The generic runner persists reviewRequiredCount alongside reviewRequiredSiteCount. API summary serialization prefers a valid reviewRequiredSiteCount (including explicit zero), so historical job 028 shows 30 reviews without editing its stored result or rerunning it. Legacy jobs without this field retain their prior count. Frontend components consume the corrected existing API field; no frontend source change is required.

## Release validation qualifications
- Final affected MW tests: 162 passed, 2 skipped, 23 subtests; full Auditor: 44 passed, 17 subtests.
- Full isolated backend persistence regression passed (mock Firebase plus SQLite worker fixtures), including shared Auditor/MW, fingerprints, contracts, upload offline tests, queue/concurrency and managed BOM tests.
- Full frontend tests, production build and 15-route smoke passed; no frontend source change.
- Broad MW initial run: 908 passed, 14 failures, 20 skipped. Two changed-rule expectations (EOS profile version, Central region-only transport) were corrected and now pass. EOS profile version traceability packets were synchronized; affected traceability tests now pass. Other failures were reproduced against untouched 3485c41 baseline (Python 3.14 fake_walk signature, existing discovery/coverage packet inconsistencies, Windows path separators, immutable Jendela rollback blob metadata and stale pair-review fixture). This is not a claim that the entire legacy MW suite is green. Complete logs and baseline comparisons are retained as region-028-*.log.
