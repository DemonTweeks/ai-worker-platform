# GitHub Issue Review

Reviewed on 2026-07-30 against `origin/main` at `a61c443`.

Query: `is:issue state:open author:MilneB21`

## Overall result

- Six open issues matched: #38, #41, #52, #54, #56, and #58.
- Each linked PR was fetched into a local `review/issue-*` branch and rebased cleanly onto current `origin/main`.
- No rebase conflicts were found.
- Focused tests and production builds passed on all six rebased branches.
- Issues #38, #41, #52, #54, and #56 have no observed main-flow blocker.
- Issue #58 is **not ready to merge**. Its retained RAN upload flow has functional blockers not covered by its tests.
- Rebases are local only; no branch was force-pushed and no GitHub state was changed.

## Issue summary and impact

| Issue / PR | Local branch | Main-flow assessment |
| --- | --- | --- |
| [#38](https://github.com/DemonTweeks/ai-worker-platform/issues/38) / [PR #39](https://github.com/DemonTweeks/ai-worker-platform/pull/39) | `review/issue-38` (`7b7abaf`) | **Low risk.** Adds `createdAt` to output-file detail and separates **Generated At** from **Expires At**. It does not change retention or execution behavior. Note: PR #39 is closed, draft, and unmerged, so the open issue is still unresolved on GitHub. |
| [#41](https://github.com/DemonTweeks/ai-worker-platform/issues/41) / [PR #43](https://github.com/DemonTweeks/ai-worker-platform/pull/43) | `review/issue-41` (`11f5dc5`) | **Low-moderate risk, no blocker found.** Persists authoritative matched MW site IDs during filtering and displays them only for successful completed jobs. Historical, failed, RAN, and all-sites jobs safely omit the entry when no list is stored. |
| [#52](https://github.com/DemonTweeks/ai-worker-platform/issues/52) / [PR #53](https://github.com/DemonTweeks/ai-worker-platform/pull/53) | `review/issue-52` (`3d599f2`) | **Low risk.** Changes viewport/focus navigation only; job selection, refresh, and two-step cancellation remain intact. The implementation is shared by PR Creator and PR Auditor, but automated coverage currently exercises PR Creator only. |
| [#54](https://github.com/DemonTweeks/ai-worker-platform/issues/54) / [PR #55](https://github.com/DemonTweeks/ai-worker-platform/pull/55) | `review/issue-54` (`a23bf4a`) | **Core-flow change, but no blocker found.** MW prevalidated uploads become session-owned and reusable; job creation copies rather than consumes the upload. Replace/remove and missing-upload handling are present. Focused frontend, API, worker-payload, concurrency, and build checks passed. |
| [#56](https://github.com/DemonTweeks/ai-worker-platform/issues/56) / [PR #57](https://github.com/DemonTweeks/ai-worker-platform/pull/57) | `review/issue-56` (`5621ea8`) | **Low risk.** Adds a job-detail link only to successful terminal console summaries with `outputFileCount > 0`. Failed, incomplete, cancelled, and zero-output jobs remain unchanged. |
| [#58](https://github.com/DemonTweeks/ai-worker-platform/issues/58) / [PR #59](https://github.com/DemonTweeks/ai-worker-platform/pull/59) | `review/issue-58` (`a3102c7`) | **Blocker - affects the main RAN flow.** See findings below. PR #59 also contains PR #55's commits and should remain dependent on #55. |

## Blocking findings for issue #58

1. **Restored RAN uploads cannot create a job.** Restoration sets `ranBomPrevalidation` and `ranEpmsPrevalidation`, but intentionally leaves `ranBomFile` and `ranEpmsFile` as `null`. `canCreateJob` still requires both browser `File` objects, so the Create Job action stays disabled after History navigation or refresh.

2. **Creating a RAN job consumes the retained uploads.** `createRanJob` still calls `consumePrevalidatedUpload` for BOM and EPMS, deletes both temporary files after copying, and does not enforce the originating browser-tab session. A successful job therefore makes the stored reusable IDs unavailable, contrary to the issue's reuse and session-scope requirements.

3. **The restored General Item project is cleared when entering RAN mode.** The component restores `ranRunMode` and `ranSelectedProject` while it initially remains in MW mode, but `handleWorkerChange('ran-pr')` resets `ranSelectedProject`. The restored project is lost before the user can create the RAN job.

4. **Tests miss the failing acceptance path.** Current tests verify that retained objects are loaded, but do not assert that `canCreateJob` becomes true, that the restored project survives switching to RAN, or that the same BOM/EPMS IDs remain reusable after job creation.

Recommended fix: make RAN readiness depend on passed reusable prevalidation IDs rather than browser `File` objects; use session-scoped non-consuming retrieval in `createRanJob`; do not delete retained BOM/EPMS sources after copying; preserve the restored project when switching into RAN mode; and add end-to-end lifecycle tests for restore -> create -> reuse/remove.

## Validation run

- #38: 5 focused frontend tests, frontend production build, backend worker-payload test - passed.
- #41: 3 focused frontend tests, frontend production build, backend worker-payload test - passed.
- #52: 4 focused frontend tests and frontend production build - passed.
- #54: 7 focused frontend/API tests, frontend production build, backend worker-payload and concurrency tests - passed.
- #56: 3 focused frontend tests and frontend production build - passed.
- #58: 8 focused frontend/API tests, frontend production build, backend worker-payload and concurrency tests - passed, but the tests do not cover the blockers above.
