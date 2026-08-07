# Active Jobs Compact Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove horizontal scrolling from shared Active Jobs cards, reduce typography and spacing, and provide a narrow-screen stacked-row fallback without changing job behavior.

**Architecture:** Retain the semantic six-column table for desktop layouts with fixed, compact column sizing. Add cell labels to both worker views so the same table can become a stacked row/card layout below 760px. Keep all styling scoped under `.workbench-result-card`.

**Tech Stack:** Vue 2.7, CSS, Vitest, Vue Test Utils, Vite.

## Global Constraints

- Apply the same Active Jobs layout to PR Creator and PR Auditor.
- Do not affect Dashboard or unrelated tables.
- Do not modify backend job lifecycle, cancellation, selection, Result Delivery, or API behavior.
- Keep body and action text at or above 11px.
- Desktop Active Jobs must not expose a horizontal scrollbar.
- Narrow screens must keep every field and both actions available without horizontal scrolling.

---

### Task 1: Add failing Active Jobs layout contracts

**Files:**
- Create: `frontend/src/__tests__/responsiveWorkbenchCss.spec.js`
- Modify: `frontend/src/views/__tests__/PRCreatorView.spec.js`
- Modify: `frontend/src/views/__tests__/PRAuditorView.spec.js`

**Interfaces:**
- Consumes: existing `.workbench-result-card`, `.download-compact`, and `.active-jobs-table` class names.
- Produces: regression contracts for desktop overflow, compact typography, narrow stacked rows, and `data-label` markup.

- [ ] **Step 1: Create the stylesheet contract test**

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../responsive-workbench.css', import.meta.url)),
  'utf8'
);

const ruleBody = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] || '';
};

describe('responsive Active Jobs layout', () => {
  it('fits the desktop table inside the result card without horizontal scrolling', () => {
    const container = ruleBody('.workbench-result-card > .download-compact');
    const table = ruleBody('.workbench-result-card .active-jobs-table');

    expect(container).toContain('overflow-x: hidden');
    expect(container).not.toContain('overflow-x: auto');
    expect(table).toContain('min-width: 0');
    expect(table).toContain('table-layout: fixed');
    expect(table).toContain('width: 100%');
  });

  it('uses compact readable typography for headers, cells and actions', () => {
    expect(ruleBody('.workbench-result-card .active-jobs-table th')).toContain('font-size: 12px');
    expect(ruleBody('.workbench-result-card .active-jobs-table td')).toMatch(/font-size:\s*(?:11|12)px/);
    expect(ruleBody('.workbench-result-card .active-jobs-table .secondary-link')).toContain('font-size: 12px');
  });

  it('provides a stacked narrow-screen row layout without restoring a table minimum width', () => {
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('.workbench-result-card .active-jobs-table thead');
    expect(css).toContain('display: none');
    expect(css).toContain('.workbench-result-card .active-jobs-table tr');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('content: attr(data-label)');
    expect(css).not.toMatch(/\.active-jobs-table\s*\{[^}]*min-width:\s*(?:640|720)px/s);
  });
});
```

- [ ] **Step 2: Extend both view tests with one active-job row and assert the six cell labels**

Expected labels:

```js
['Job ID', 'Worker', 'Status', 'Created', 'View', 'Stop/Cancel']
```

Also assert that `View` and `Stop / Cancel` buttons are rendered.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm --prefix frontend run test:unit -- \
  src/__tests__/responsiveWorkbenchCss.spec.js \
  src/views/__tests__/PRCreatorView.spec.js \
  src/views/__tests__/PRAuditorView.spec.js
```

Expected: stylesheet contract fails because the current rules use `overflow-x: auto`, `min-width: 720px`, and no compact desktop typography; component label tests fail because cells have no `data-label` attributes.

- [ ] **Step 4: Commit the failing tests**

```bash
git add frontend/src/__tests__/responsiveWorkbenchCss.spec.js \
  frontend/src/views/__tests__/PRCreatorView.spec.js \
  frontend/src/views/__tests__/PRAuditorView.spec.js
git commit -m "test(ui): cover compact Active Jobs layout"
```

---

### Task 2: Implement compact desktop and stacked narrow-screen layout

**Files:**
- Modify: `frontend/src/responsive-workbench.css`
- Modify: `frontend/src/views/PRCreatorView.vue`
- Modify: `frontend/src/views/PRAuditorView.vue`

**Interfaces:**
- Consumes: the six existing Active Jobs columns and button actions.
- Produces: compact desktop table styling and `data-label` attributes used by the narrow-screen CSS.

- [ ] **Step 1: Add `data-label` to the six cells in both views**

```html
<td data-label="Job ID">...</td>
<td data-label="Worker">...</td>
<td data-label="Status">...</td>
<td data-label="Created">...</td>
<td data-label="View">...</td>
<td data-label="Stop/Cancel">...</td>
```

- [ ] **Step 2: Replace the overflow and table minimum-width rules**

The desktop contract must include:

```css
.workbench-result-card > .download-compact {
  min-width: 0;
  overflow-x: hidden;
  width: 100%;
}

.workbench-result-card .active-jobs-table {
  border-collapse: collapse;
  min-width: 0;
  table-layout: fixed;
  width: 100%;
}
```

- [ ] **Step 3: Apply compact scoped typography and actions**

Use 12px headers, 11–12px body text, 12px buttons, compact padding, and action minimum heights of approximately 30–32px. Keep controlled wrapping and rebalance the six column widths so Job ID and Created receive the largest shares.

- [ ] **Step 4: Add the narrow-screen stacked-row rules**

Below 760px:

```css
.workbench-result-card .active-jobs-table,
.workbench-result-card .active-jobs-table tbody,
.workbench-result-card .active-jobs-table tr,
.workbench-result-card .active-jobs-table td {
  display: block;
  width: 100%;
}

.workbench-result-card .active-jobs-table thead {
  display: none;
}

.workbench-result-card .active-jobs-table tr {
  display: grid;
  gap: 0;
  grid-template-columns: minmax(0, 1fr);
}

.workbench-result-card .active-jobs-table td::before {
  content: attr(data-label);
}
```

Style each cell as a two-column label/value grid and make action buttons fill their available cell width.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the same focused command from Task 1. Expected: PASS.

- [ ] **Step 6: Commit the implementation**

```bash
git add frontend/src/responsive-workbench.css \
  frontend/src/views/PRCreatorView.vue \
  frontend/src/views/PRAuditorView.vue
git commit -m "fix(ui): compact Active Jobs without horizontal scroll"
```

---

### Task 3: Full verification and PR

**Files:**
- No production files beyond Tasks 1–2.

- [ ] **Step 1: Run the full frontend verification**

```bash
npm --prefix frontend run test:unit
npm --prefix frontend run build
npm --prefix frontend run smoke
```

Expected: all commands pass with no new warnings or errors.

- [ ] **Step 2: Review the changed-file scope**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short
```

Expected: only the design/plan docs, focused tests, shared stylesheet, and two worker views are changed; worktree is clean.

- [ ] **Step 3: Open a Draft PR**

Title:

```text
fix(ui): compact Active Jobs without horizontal scrolling
```

Body must link `Fixes #80`, summarize root cause and implementation, and record the exact verification results.
