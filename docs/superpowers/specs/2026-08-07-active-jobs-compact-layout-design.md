# Active Jobs Compact Layout Design

## Context

Issue #80 follows the responsive containment work from Issue #26 / PR #75. The existing stylesheet applies `overflow-x: auto` to the result content container and fixed `min-width` values of `720px` and `640px` to the Active Jobs table. At the reproduced desktop workbench width, those rules necessarily produce a horizontal scrollbar. The table and action controls also inherit a density that is too large for the six-column card.

## Goal

Make the shared Active Jobs presentation fit inside the PR Creator and PR Auditor workbench cards at supported desktop widths, reduce typography and spacing, and provide a narrow-screen layout that does not depend on horizontal scrolling.

## Options considered

### Option A — Shrink the desktop table only

Remove the minimum width and reduce typography. This is the smallest change, but narrow screens would still compress six columns into an unreadable layout.

### Option B — Scoped CSS desktop table plus stacked narrow rows (selected)

Keep the existing semantic six-column table at desktop widths with fixed column allocation and compact typography. Below 760px, preserve the table header for assistive technology, visually collapse it, and transform each row into a labelled stacked card using column-specific pseudo-labels. Both worker views already use the same column order, so no component or runtime change is required.

### Option C — Hide secondary columns

Hide worker or created-time information below a breakpoint. This would reduce layout pressure but violates the requirement to keep all important fields and actions available.

## Selected design

1. Scope every rule under `.workbench-result-card` so Dashboard and unrelated tables remain unchanged.
2. Change the result content container to `overflow-x: hidden`.
3. Remove the fixed `720px` and `640px` table minimum widths; use `min-width: 0`, `max-width: 100%`, `table-layout: fixed`, and `width: 100%`.
4. Apply compact desktop density:
   - headers: 12px;
   - body: 12px;
   - actions: 12px;
   - cell padding: 6px by 5px;
   - action minimum height: 30px.
5. Allocate the largest desktop shares to Job ID, Created, and Stop/Cancel while keeping View compact.
6. Below 760px:
   - keep the table header in the accessibility tree while visually hiding it;
   - render the body as a vertical grid;
   - render each row as a contained card;
   - render every cell as a two-column label/value grid;
   - supply visual labels through the stable six-column order;
   - keep both action buttons full-width within their value column.
7. Preserve job selection, cancellation, Result Delivery, API calls, and backend behavior unchanged.

## Testing

A focused Vitest stylesheet contract verifies:

- no desktop horizontal-scroll rule;
- no fixed Active Jobs table minimum width;
- compact header, cell, and action typography;
- the 760px stacked-row fallback;
- visible labels for the first and final columns;
- all selectors remain scoped to `.workbench-result-card`.

Full frontend unit, build, and route-smoke verification remains the final repository gate.
