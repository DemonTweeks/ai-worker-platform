# Active Jobs Compact Layout Design

## Context

Issue #80 follows the responsive containment work from Issue #26 / PR #75. The current stylesheet intentionally applies `overflow-x: auto` to the result content container and a `min-width: 720px` to the Active Jobs table. At the reproduced desktop viewport, those rules force a horizontal scrollbar. The shared button defaults also keep action controls and text larger than the available card density.

## Goal

Make the shared Active Jobs presentation fit entirely inside the PR Creator and PR Auditor workbench cards at supported desktop widths, reduce its typography and spacing, and provide a narrow-screen layout that does not depend on horizontal scrolling.

## Options considered

### Option A — CSS-only shrink

Remove the table minimum width and reduce font size and padding. This is the smallest change, but it leaves narrow screens vulnerable to unreadable columns and does not provide a deliberate responsive fallback.

### Option B — Desktop table plus narrow-screen stacked rows (selected)

Keep the semantic table at desktop widths with fixed column allocation, compact typography, controlled wrapping, and compact actions. At the narrow breakpoint, transform each table row into a stacked card and expose cell labels through `data-label` attributes. This preserves every field and action without horizontal scrolling.

### Option C — Hide secondary columns on small screens

Hide worker or created-time information below a breakpoint. This is simpler than stacked rows, but it violates the requirement that important fields remain directly available.

## Selected design

1. Scope all changes under `.workbench-result-card` so Dashboard and unrelated tables remain unchanged.
2. Change the Active Jobs content container to `overflow-x: hidden`.
3. Remove the fixed `720px` / `640px` table minimum widths and keep `table-layout: fixed; width: 100%`.
4. Use compact desktop typography:
   - headers: 12px, semibold/bold;
   - body: 11–12px;
   - actions: 12px;
   - cells: compact vertical and horizontal padding;
   - actions: reduced minimum height.
5. Rebalance desktop column widths so Job ID and Created receive the largest allocations while action columns remain compact.
6. Add `data-label` attributes to Active Jobs cells in both PR Creator and PR Auditor.
7. At `max-width: 760px`, hide the table header and render each row as a stacked grid/card. Each cell renders its label from `data-label`, and both action buttons span the available row width.
8. Preserve job lifecycle, cancellation, navigation, Result Delivery, and backend behavior unchanged.

## Testing

- Add a focused Vitest stylesheet contract test that verifies:
  - no horizontal-scroll rule;
  - no fixed table minimum width;
  - compact header/body/action typography;
  - narrow-screen stacked-row rules;
  - selectors remain scoped to `.workbench-result-card`.
- Extend PR Creator and PR Auditor component tests to verify the six `data-label` values are present and both actions remain rendered.
- Run focused unit tests, the full frontend unit suite, production build, and route smoke checks.
