# Issue 84 Dashboard UI Polish Rebuild Design

## Goal

Rebuild the valid frontend improvements from PR #87 on top of current `main` after PR #89, without regressing platform-global Status navigation, Issue #88 reconciliation presentation, or the established Active Jobs no-horizontal-scroll requirement.

## Approved scope

- Keep platform-global navigation: Health / Dashboard / Status / History / Admin.
- Preserve same-tab selected-job storage/event behavior that powers Status.
- Add the PR #87 sticky header behavior: hide on downward scroll, reveal on upward scroll/focus.
- Keep Dashboard Active Jobs full-width layout while fitting content inside the card with no horizontal scrolling.
- Standardize audited user-visible timestamps through shared browser-local formatters; keep Active Jobs timestamps compact but allow safe wrapping when required to preserve no-scroll behavior.
- Keep the Vue Test Utils compatibility fixes that replace unsupported `flushPromises` imports.
- Preserve all current-main Issue #88 reconciliation UI/API-facing behavior.
- Do not introduce RAN-specific lifecycle changes or alter worker business rules.

## Integration strategy

Create an internal branch from current `main`. Replay PR #87, restore current-main Status navigation and selected-job synchronization, and retain current-main Issue #88 changes. Override the PR #87 mobile horizontal-overflow rule so Active Jobs stays within its card instead of forcing a 640px table or horizontal scrollbar.

## Validation

Run targeted App navigation/sticky-header tests, targeted Dashboard no-scroll tests, the complete frontend unit suite, production build, route smoke, and `git diff --check`. Review the resulting diff against PR #87 and current main to confirm no Issue #88 reconciliation regression. Require no unresolved actionable review blocker before merge.
