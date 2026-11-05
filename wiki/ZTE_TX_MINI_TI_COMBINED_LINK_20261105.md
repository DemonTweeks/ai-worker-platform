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
