# Issue #21 Compact Dropdowns Implementation Plan

**Goal:** Make the RAN General Item project selector and Stop Job cancellation-reason selector compact, visually aligned with nearby controls, and safe for long selected values without changing behavior.

**Current evidence:** Both target selects live in `frontend/src/views/HomeView.vue` and currently use the broad `cockpit-sites-input` class. Existing tests already cover General Item job creation and controlled cancellation submission, so the safest path is a focused styling change plus targeted assertions if meaningful.

## Planned implementation

1. Add a narrowly scoped select class in `frontend/src/views/HomeView.vue` for the two Issue #21 controls only.
2. Introduce compact select styling in `frontend/src/styles.css` that:
   - keeps the controls visually aligned with nearby compact workbench fields;
   - preserves native select behavior and keyboard navigation;
   - constrains long selected text with ellipsis-safe overflow handling where supported;
   - avoids changing other shared inputs, textareas, or admin/history selects.
3. Recheck whether the conditional "other" cancellation text input still aligns cleanly after the select compaction.
4. Update `frontend/src/views/__tests__/HomeView.spec.js` only if the repository’s current test setup can meaningfully assert the new class wiring without brittle visual assertions.

## Risk assessment

- The main risk is overloading `cockpit-sites-input` and accidentally changing unrelated controls, so the implementation should prefer a new opt-in class over changing the shared class globally.
- Native `<select>` truncation support varies by browser, so the CSS should stay conservative and avoid custom replacements that could break keyboard behavior.
- The cancellation flow must remain payload-compatible; no option values, submit code, or cancellation semantics should change.

## Validation plan

- Run focused frontend tests first around `HomeView`.
- Then run the required mission gates:
  - `npm.cmd --prefix frontend test`
  - `npm.cmd --prefix frontend run build`
  - `git diff --check`
  - `git status --short`
  - `git submodule status --recursive`

## First bounded continuation step completed

This startup pass completed discovery and planning only. The next autonomous step should be the first code change: add the narrow select hook and compact styles for the two dropdowns.

## Progress update after implementation step

The narrow select hook and compact styles are now implemented. The next autonomous step should run the full required frontend validation, then perform browser-based UAT focused on long selected values, keyboard behavior, and Job Detail visual safety.

## Progress update after validation and partial UAT

The required local validation commands are now passing. The remaining work is evidence-focused browser UAT under a live state where:

- the RAN project catalog endpoint returns actual workbook-backed projects; and
- the current browser-tab session has an active job that exposes the Stop Job cancellation form.

Once those conditions are available, the next autonomous step should complete the remaining keyboard and live-selection checks, then move into review, final reporting, push, and Draft PR creation.
