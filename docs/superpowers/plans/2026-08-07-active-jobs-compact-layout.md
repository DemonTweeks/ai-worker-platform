# Active Jobs Compact Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove horizontal scrolling from shared Active Jobs cards, reduce typography and spacing, and provide a narrow-screen stacked-row fallback without changing job behavior.

**Architecture:** Retain the existing semantic six-column table for desktop layouts with fixed, compact column sizing. Below 760px, preserve the table header for accessibility and use scoped CSS to display each row as a labelled stacked card. Both worker views share the same table structure, so the production change remains isolated to the shared responsive stylesheet.

**Tech Stack:** Vue 2.7, CSS, Vitest, Vite.

## Global Constraints

- Apply the same Active Jobs layout to PR Creator and PR Auditor.
- Do not affect Dashboard or unrelated tables.
- Do not modify backend job lifecycle, cancellation, selection, Result Delivery, or API behavior.
- Keep body and action text at or above 11px.
- Desktop Active Jobs must not expose a horizontal scrollbar.
- Narrow screens must keep every field and both actions available without horizontal scrolling.

---

### Task 1: Add the failing stylesheet contract

**Files:**
- Create: `frontend/src/__tests__/responsiveWorkbenchCss.spec.js`

- [x] **Step 1: Write the stylesheet contract**

The test verifies:

```text
overflow-x: hidden
min-width: 0
table-layout: fixed
width: 100%
12px header/body/action typography
760px stacked-row fallback
Job ID and Stop/Cancel pseudo-labels
no 720px or 640px table minimum width
stacked cells override desktop percentage widths
```

- [x] **Step 2: Verify RED against the pre-fix stylesheet**

The isolated contract failed because the existing container contained `overflow-x: auto` and the table retained fixed minimum widths.

- [x] **Step 3: Commit the failing test**

Commit: `test(ui): cover compact Active Jobs layout`.

---

### Task 2: Implement the compact shared stylesheet

**Files:**
- Modify: `frontend/src/responsive-workbench.css`

- [x] **Step 1: Remove the horizontal-scroll and fixed-minimum-width contract**

- [x] **Step 2: Apply compact typography, spacing, and column allocation**

Implemented values:

```text
Header: 12px
Body: 12px
Actions: 12px
Cell padding: 6px 5px
Action minimum height: 30px
Column allocation: 19 / 15 / 12 / 22 / 12 / 20 percent
```

- [x] **Step 3: Add the narrow-screen stacked layout**

Below 760px, the table header remains available to assistive technology, rows become contained cards, cells become label/value grids, desktop percentage widths are overridden to `100%`, and both actions remain visible.

- [x] **Step 4: Verify GREEN with the focused contract**

Final GitHub Actions result:

```text
1 test file passed
4 tests passed
```

- [x] **Step 5: Commit the implementation**

Commit: `fix(ui): compact Active Jobs without horizontal scroll`.

---

### Task 3: Repository verification and PR

- [x] **Step 1: Run the final Issue #80 gate**

```text
Focused CSS contract: PASS — 4/4
Vite production build: PASS — 111 modules transformed
Route smoke: PASS — 10/10 routes returned successfully
```

- [x] **Step 2: Compare the branch unit suite with current main**

Both the PR branch and current `main` reproduce the same unrelated baseline failures:

```text
4 failures: flushPromises is not a function
- PRCreatorView.spec.js: 1
- PRCreatorRanRetention.spec.js: 3
```

Issue #80 adds no new unit-test failure. The focused contract passes only on the branch because the test is new.

- [x] **Step 3: Open Draft PR #81**

Title: `fix(ui): compact Active Jobs without horizontal scrolling`.

- [x] **Step 4: Remove temporary verification workflows after capturing evidence**

No temporary workflow remains in the final diff.

- [x] **Step 5: Review final changed-file scope**

Final branch diff contains only:

```text
frontend/src/responsive-workbench.css
frontend/src/__tests__/responsiveWorkbenchCss.spec.js
docs/superpowers/specs/2026-08-07-active-jobs-compact-layout-design.md
docs/superpowers/plans/2026-08-07-active-jobs-compact-layout.md
```

- [ ] **Step 6: Complete browser UAT at the reproduced viewport**

Acceptance checks:

```text
No horizontal scrollbar
All six columns visible on desktop
View and Stop/Cancel fully visible
Text visibly smaller and readable
Narrow layout stacks rows without hiding actions
```
