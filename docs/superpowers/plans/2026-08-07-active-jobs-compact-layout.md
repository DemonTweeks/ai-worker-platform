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

**Interfaces:**
- Consumes: existing `.workbench-result-card`, `.download-compact`, and `.active-jobs-table` selectors.
- Produces: regression contracts for desktop overflow, compact typography, and narrow stacked rows.

- [x] **Step 1: Write the stylesheet contract**

The test reads `frontend/src/responsive-workbench.css` and asserts:

```text
overflow-x: hidden
min-width: 0
table-layout: fixed
width: 100%
12px header/body/action typography
760px stacked-row fallback
Job ID and Stop/Cancel pseudo-labels
no 720px or 640px table minimum width
```

- [x] **Step 2: Verify RED against the pre-fix stylesheet**

The isolated contract failed on the first expected assertion because the existing container contained:

```css
overflow-x: auto;
```

- [x] **Step 3: Commit the failing test**

Commit:

```text
test(ui): cover compact Active Jobs layout
```

---

### Task 2: Implement the compact shared stylesheet

**Files:**
- Modify: `frontend/src/responsive-workbench.css`

**Interfaces:**
- Consumes: the existing stable six-column order used by PR Creator and PR Auditor.
- Produces: compact desktop table styling and a visual narrow-screen label/value layout.

- [x] **Step 1: Remove the horizontal-scroll and fixed-minimum-width contract**

Required desktop rules:

```css
.workbench-result-card > .download-compact {
  min-width: 0;
  overflow-x: hidden;
  width: 100%;
}

.workbench-result-card .active-jobs-table {
  max-width: 100%;
  min-width: 0;
  table-layout: fixed;
  width: 100%;
}
```

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

Below 760px:

- keep `thead` in the accessibility tree while visually hiding it;
- render `tbody` as a grid;
- render each `tr` as a contained card;
- render each `td` as a label/value grid;
- add stable visual labels for all six columns through `nth-child` pseudo-elements;
- stretch both action buttons within their value column.

- [x] **Step 4: Verify GREEN with the same isolated contract**

Result:

```text
Issue #80 CSS contract passed
```

- [x] **Step 5: Commit the implementation**

Commit:

```text
fix(ui): compact Active Jobs without horizontal scroll
```

---

### Task 3: Repository verification and PR

**Files:**
- Temporary verification workflow: `.github/workflows/issue-80-frontend.yml`

- [x] **Step 1: Add a temporary GitHub Actions gate**

The workflow runs:

```bash
npm ci
npm run test:unit -- src/__tests__/responsiveWorkbenchCss.spec.js
npm test
```

- [x] **Step 2: Open Draft PR #81**

Title:

```text
fix(ui): compact Active Jobs without horizontal scrolling
```

- [ ] **Step 3: Confirm repository verification**

Required results:

```bash
npm --prefix frontend run test:unit
npm --prefix frontend run build
npm --prefix frontend run smoke
```

- [ ] **Step 4: Complete browser UAT at the reproduced viewport**

Acceptance checks:

```text
No horizontal scrollbar
All six columns visible on desktop
View and Stop/Cancel fully visible
Text visibly smaller and readable
Narrow layout stacks rows without hiding actions
```

- [ ] **Step 5: Remove the temporary workflow after verification**

Remove `.github/workflows/issue-80-frontend.yml`, confirm the final diff remains scoped, and update PR #81 with exact evidence.
