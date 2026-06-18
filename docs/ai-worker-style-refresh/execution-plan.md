# AI Worker Style Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use relevant Superpowers execution guidance before implementation phases. Steps are bounded for recurring automation and should be checked off or summarized in state/log files as work proceeds.

**Goal:** Adapt reusable design principles from the reference website into the existing AI Worker Vue 2 interface without changing routes, workflows, backend behavior, business logic, submodules, or create-pr-cd logic.

**Architecture:** Keep the current Vue 2/Vite app and route structure. Implement the refresh primarily through `frontend/src/styles.css`, with small template-class adjustments only where needed to improve hierarchy, responsive behavior, or accessibility without altering data flow.

**Tech Stack:** Vue 2.7, Vue Router 3, Vite 7, plain CSS, existing Node test scripts.

---

## Evidence From Inspection

- Routes are defined in `frontend/src/router.js` and already include `/`, `/history`, `/jobs/:jobId`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, and `/admin/health`.
- `frontend/scripts/route-smoke.js` verifies the required preservation routes and checks that `LLM_API_KEY` text is not exposed.
- The primary app shell is `frontend/src/App.vue`; the main cockpit is `frontend/src/views/HomeView.vue`.
- History and detail pages use `portal-shell`; admin pages use `admin-shell` and shared admin components.
- The existing stylesheet already contains a ZTE/light SaaS layer, cockpit layout, portal shell, cards, badges, forms, and responsive breakpoints.
- Reference analysis recommends constrained containers, calm light surfaces, soft card borders, restrained shadows, clear active navigation, full-width mobile CTAs, visible focus states, reduced-motion support, and avoiding clone-like copying.

## Chosen Design Direction

Use a "polished operations cockpit" adaptation rather than a marketing-page clone. The app is an internal work tool, so the refresh should improve density, rhythm, hierarchy, form affordance, and route consistency while preserving the product's direct workflow.

Rejected approaches:

- Full homepage redesign: too risky for route/workflow preservation and not aligned with the cockpit product.
- Component-library introduction: unnecessary for a Vue 2 app with existing CSS and would expand risk.
- Reference-site mimicry: violates originality requirements and would not fit AI Worker's operational UI.

## Files To Modify

- Modify `frontend/src/styles.css`: design tokens, global background, shells, cards, buttons, inputs, focus/reduced-motion, responsive rhythm.
- Modify `frontend/src/App.vue` only if needed to remove emoji-only/color-only health labels or improve accessible status text.
- Modify `frontend/src/views/HomeView.vue` only if needed for semantic grouping, class hooks, or accessible labels while preserving behavior.
- Modify `frontend/src/views/JobHistoryView.vue`, `frontend/src/views/JobDetailView.vue`, and admin views only if template hooks are needed for consistent page title hierarchy.
- Do not modify backend files, route definitions, APIs, submodules, storage outputs, or generated runtime files.

## Task 1: Global Tokens And Motion Safeguards

- [ ] Review the current `:root` block in `frontend/src/styles.css`.
- [ ] Add original AI Worker design tokens for background bands, surface, elevated surface, muted text, border, focus ring, shadows, and compact spacing.
- [ ] Keep the brand blue but shift the supporting palette away from a single blue-only theme by adding neutral, slate, cyan, and subtle green/yellow/red status tokens.
- [ ] Add `@media (prefers-reduced-motion: reduce)` rules that disable hover translate/scale, shimmer, progress drift, and scroll animation.
- [ ] Run `npm --prefix frontend run build`.
- [ ] Commit if this task creates a stable, meaningful CSS checkpoint.

## Task 2: Shell, Navigation, And Section Rhythm

- [ ] Refine `.app-shell`, `.app-header`, `.page-main`, `.portal-shell`, `.admin-shell`, and `.home-cockpit` so desktop content width is consistent and mobile gutters stay at or above 16px.
- [ ] Preserve current navigation destinations and active states.
- [ ] Improve the header's scan hierarchy with a lighter surface, clearer health pill, and stable wrapping at tablet/mobile widths.
- [ ] Ensure no hero-scale type is used inside compact operational panels.
- [ ] Run `npm --prefix frontend run build`.
- [ ] Commit if the shell is stable.

## Task 3: Card, Form, Button, And Status Polish

- [ ] Refine `.panel`, `.cockpit-card`, `.stat-card`, `.job-card`, `.health-card`, admin cards, and empty states using restrained borders and shadows.
- [ ] Refine shared buttons and links so primary, secondary, download, tertiary, and segmented controls have clear hierarchy.
- [ ] Improve inputs, selects, textareas, file inputs, and validation states with visible focus and consistent field spacing.
- [ ] Avoid making non-clickable cards look excessively clickable; reserve stronger hover for interactive cards/buttons.
- [ ] Run `npm --prefix frontend run build`.
- [ ] Commit if the style layer is stable.

## Task 4: Page-Specific Responsive Refinement

- [ ] Validate the home cockpit at desktop, tablet, and mobile breakpoints. If the fixed-height cockpit causes clipping, adjust CSS while preserving the same workflow.
- [ ] Refine history stats/cards and filters for 360px, 390px, 768px, 1024px, and desktop widths.
- [ ] Refine detail page two-column sections and admin tables/forms for readable wrapping.
- [ ] Keep all existing features, fields, buttons, and route destinations intact.
- [ ] Run `npm --prefix frontend test`.
- [ ] Commit if the frontend baseline passes.

## Task 5: Backend Baseline And Runtime Artifact Safety

- [ ] Confirm no backend production code was modified.
- [ ] Run `npm --prefix backend test` from the feature worktree.
- [ ] Ensure Python-dependent backend checks use or can reach `C:\dev\ai-worker-platform\.venv\Scripts\python.exe`.
- [ ] Check `git status --short` for generated runtime files under `storage/`, preserving `.gitkeep` files and avoiding output commits.
- [ ] Record results in `verification-log.md`.

## Task 6: Browser, Route, Viewport, And Screenshot Evidence

- [ ] Start the frontend preview or dev server only when needed for browser checks.
- [ ] Check required routes: `/`, `/history`, `/jobs/QA15-ROUTE-SMOKE`, `/admin/login`, `/admin/assets`, `/admin/audit-logs`, `/admin/health`.
- [ ] Verify representative desktop and mobile viewports, including 360px width.
- [ ] Capture before/after screenshots or document why baseline "before" evidence is the reference screenshot set plus git history.
- [ ] Record screenshot paths or notes in `before-after-screenshots.md`.

## Task 7: Review, Final Verification, And Completion

- [ ] Use code-review guidance to inspect changed files for regressions, route/workflow changes, accessibility misses, and test gaps.
- [ ] Resolve or explicitly close review findings in `review-findings.md`.
- [ ] Confirm submodules are unchanged.
- [ ] Confirm no push, merge, or deployment occurred.
- [ ] Write the final report with all required sections.
- [ ] Confirm final git status is clean except intended committed changes.
- [ ] Create `docs/ai-worker-style-refresh/COMPLETED` and set `completed=true` only after every final acceptance gate passes.
