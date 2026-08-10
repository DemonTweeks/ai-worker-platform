# Issue 84 Dashboard UI Polish Rebuild Design

## Goal

Rebuild the valid frontend improvements from PR #87 on top of current `main` after PR #89, without regressing platform-global Status navigation or Issue #88 reconciliation presentation.

## Approved scope

- Keep platform-global navigation: Health / Dashboard / Status / History / Admin.
- Preserve same-tab selected-job storage/event behavior that powers Status.
- Add the PR #87 sticky header behavior: hide on downward scroll, reveal on upward scroll/focus.
- Keep Dashboard Active Jobs full-width/responsive layout changes.
- Standardize audited user-visible timestamps through shared browser-local formatters; keep Active Jobs timestamps compact and non-wrapping.
- Keep the Vue Test Utils compatibility fixes that replace unsupported `flushPromises` imports.
- Preserve all current-main Issue #88 reconciliation UI/API-facing behavior.
- Do not introduce RAN-specific lifecycle changes or alter worker business rules.

## Integration strategy

Create an internal branch from current `main`. For files untouched by PR #89, replay PR #87 content directly. For files changed by both PR #87 and current main, use current main as the source of truth and apply only the small PR #87 timestamp/test changes. For `App.vue` and navigation tests, preserve Status behavior while adding sticky-header behavior.

## Validation

Run frontend unit tests, production build, route smoke, and `git diff --check`. Review the resulting diff against PR #87 and current main to confirm no Issue #88 reconciliation regression. Require no unresolved actionable review blocker before merge.
