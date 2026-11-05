# ZTE TX MINI TI combined-link correction â€” 2026-11-05

Owner approval in conversation: treat MW New Link / Reroute as one category; recognize MW New Link under it; Equipment Installation actual end and Microwave BOQ Configuration are non-inputs. Apply fixes, publish main, restart and rerun original PR-20261105-017 through CDP.

## Scope and safeguards
- MW 4.1.1: ZTE TX MINI (`zte_tx_mini_pr_v1`), TI, MW New Link / Reroute only. The original `MW New Link` value/evidence is retained; global identity-only SOW registry is unchanged.
- One `COMBINED_LINK` business category; no mandatory new-link-versus-reroute classification. Installation items still require approved antenna evidence. Dismantling is included only with explicit approved work, old size and count; uncertain/conflicting work remains blocked. The approved PR Model workbook is unchanged.
- K/Y/Z exact source mappings approved for this category. R BOQ is ignored even when supplied. BH Equipment Installation actual end is not required, including the legacy UAT bridge.
- Actual production canonical partitioning did not use the legacy date gate. The earlier diagnosis overstated BH as a guaranteed production blocker; the exemption makes the legacy bridge consistent too.
- Preserve G Province/State for this category only: Pahang was present in the source but discarded by the old profile. Transport continues using the existing governed geography mapping, without region-only guessing. Missing/unknown state still fails closed.
- Core fields: A customer site code; D region; L Microwave Tx SOW; AG Subcon - TI; AH Subcon PR - TI (blank allowed; source required). G is needed for West Malaysia transport. Technical evidence: K TX SOW Details, Y/Z NE/FE antenna sizes. No R/BH requirement. Other profiles/scopes/categories remain unchanged.
- Auditor 1.2.1 declares MW 4.1.1 compatibility; shared dependency fingerprint/queued-identity protections retained, no nested dependency copy.

## Verification and activation
- Isolated run against supplied workbook: requested=1, generated=1, review=0, failed=0, unaccounted=0; source row 575, site 8488P_USP, TI.
- Reopened ECC: two model-derived Hop rows, quantity 1 each: 350000214939 (KV warehouse to Pahang transport), 350001095410 (new MW link 0.9/1.2m, two antenna bucket). No dismantle lines. NE 1.2m / FE 0.6m selects the existing maximum-endpoint bucket.
- Private workbook, generated ECCs and logs stay outside Git in the conversation evidence directory. No iEPMS submission.
- Platform contract, fingerprint, MW live runner and shared-MW Auditor checks run in isolated mock storage. Shared dependency changes remain blocked.
- Full/targeted Python suite results and production rerun evidence to be recorded after completion.
- Preserve newer production commits 2efc90c, 8d3b08c and 0eb424e. Publish dependency repositories before platform gitlinks. Restart backend only after idle-queue verification; frontend unchanged.

## Test qualification
- Six new category regressions pass; date eligibility, SOW normalization, MW link-scope production generator tests, negative acceptance and adapter suites pass (adapter: 70 tests, 2 skips; link scope: 22 tests).
- Private final ECC reopened and asserted exact two PBOM rows, site code and quantity 1 each. Output source workbook is unchanged.
- Initial broad MW discovery: 895 tests, 16 failures, 2 errors, 3 skips. Stale 4.1.0 Planning test request/result fixtures corrected to read the manifest version; rerun separately. Unicode-sensitive Issue77 suite passes all 5 tests with PYTHONUTF8=1.
- Remaining unrelated failures reproduced verbatim on unchanged deployed MW 8fb4fd5: rollback metadata/blob checks (3 failures), Windows path separators in promotion test (1 failure), Python 3.14 mocked os.walk signature (1 error). Not silently fixed or represented as a clean full-suite pass.
- Initial concurrent Auditor run detected stale package approval after a source edit. Final fingerprint refreshed; shared integration passes with tamper/missing/incompatible/queued-change checks. Final full Auditor suite rerun after version-aware test fixtures.
- Full backend/frontend suites not rerun: no frontend changes. Targeted platform contract, fingerprint, engine integrity, MW live runner and shared Auditor tests pass.

## Completed release and production rerun
- MW 4.1.1: `7c61433ee5380dbc8dabe5679d9613e532aeae31`; package SHA256 `838c61866acd20dd35ec0d45084e86280587192cae55bf3802296f23713d8090`.
- Auditor 1.2.1: `91968df7f9c072ed2b908b60218564179b9b9459`; package SHA256 `cb227db73e02dc5bfcb0223b456d7573e317b0f7bcea6be6b178e08fbc6dd2ec`.
- Platform activation `909878b76956b2cda9d93a368c95471d3d535830` published non-force to main; production fast-forwarded, pinned recursive submodules activated, both approvals validated.
- Production queue idle before restart; backend PID 16588 stopped and PID 14400 started using existing production profile. Frontend/config/SQLite database unchanged. Health backend/SQLite/Agnes all ok.
- Chrome CDP port 19222: read original job then clicked Rerun Job once. New job `PR-20261105-018`, source `PR-20261105-017`, TI, site 8488P_USP, MW 4.1.1. Completed with 1 generated, 0 review, 0 warning, 0 failed, 0 unaccounted. No iEPMS submission.
- Browser initially retained old job content after hash navigation; reload of the new job cleared the stale view. No second rerun.
- Production input SHA256 preserved: `c8c8b5d6b862b3951b9ebaf3298a51ac758f4ee43cf71174a276c2807398cfea`.
- Reopened production ECC: two rows, PBOM 350000214939 and 350001095410, quantity 1 Hop each; no dismantle lines. All declared output SHA256 values verified; ZIP integrity and contents checked.
- Production output remains `storage/jobs/PR-20261105-018/output/Eastern-GTSB ZTE TX MINI TI PR 20261105.xlsx`; ECC SHA256 `b4eeb16197765b883b16fe969e35076d5621c5e410fc164b51bf78a8237e3678`.

## Final test qualification
- New category tests: 6 passed. Adapter: 70 tests, 2 skips. Link scope production tests: 22 passed. Date, normalization and negative-acceptance suites passed. Final full Auditor: 44 passed. Planning public contract: 7 passed, including all eight profiles. Unicode-sensitive Issue77 model suite: 5 passed with UTF-8.
- Platform contract, fingerprint normalization, engine integrity and shared-MW Auditor integration passed. MW live runner passed. Dependency missing/tampered/incompatible and queued dependency changes still rejected.
- Initial full MW discovery: 895 tests, 16 failures, 2 errors, 3 skips. New-version Planning fixtures corrected and passed separately; Unicode issue passed under UTF-8. Remaining unrelated failures reproduced on unchanged deployed 8fb4fd5: rollback metadata/blob checks (3 failures), Windows promotion path separators (1 failure), Python3.14 mocked os.walk signature (1 error). This is NOT claimed as an all-green full MW suite.
- Development Auditor's obsolete untracked nested dependencies preserved outside application in conversation folder `retained-auditor-legacy-dependencies-20261105`; no deletion or runtime fallback.
- Private evidence and generated workbooks retained in conversation folder: `zte-production-rerun-verification.json`, `zte-ti-final-acceptance/`, targeted/full-suite logs. No workbook, credentials, database or generated deliverable committed.
