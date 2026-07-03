# AI Worker Platform — Issue #29 Autonomous Master Prompt

## 1. Mission Identity

Repository:

```text
DemonTweeks/ai-worker-platform
```

GitHub Issue:

```text
#29 — feat(navigation): make AI Workers top-level routes and split PR Creator from PR Auditor
```

Mission objective:

```text
Refactor the frontend information architecture so PR Creator and PR Auditor
are independent top-level AI Workers with independent routes and pages.

MW PR and RAN PR remain internal PR Creator modes.
```

This is a complete implementation mission. Do not stop at discovery, planning, prototype work, or partial refactoring.

---

## 2. Non-Negotiable Product Hierarchy

```text
AI Worker Platform
│
├─ PR Creator
│  ├─ MW PR creation
│  └─ RAN PR creation
│
├─ PR Auditor
│
├─ BOM Maker                 ← future Worker
│
└─ Material Controller       ← future Worker
```

Product rules:

* PR Creator is one top-level Worker.
* MW PR and RAN PR are PR Creator internal capabilities.
* PR Auditor is a separate top-level Worker.
* Future Workers must be added through centralized Worker registration, route registration, and a dedicated page.
* Do not make future Workers branches inside one giant Worker form component.

---

## 3. Parent PR, Branch, and Worktree Rules

This is a stacked PR depending on Draft PR #28.

Parent PR context:

```text
PR #28: [codex] Integrate PR Auditor worker
Parent branch: feature/pr-auditor-platform-integration
Expected parent head at mission creation:
4c904e821be63a80990a1ca2b176bcd680798b85
```

Create the mission from the parent branch, never from `main`.

```text
Source branch:
feature/pr-auditor-platform-integration

Feature branch:
feat/issue-29-top-level-worker-navigation

Feature worktree:
C:\dev\ai-worker-platform-worker-navigation
```

Before changing code:

1. Fetch `origin`.
2. Verify the parent branch exists.
3. Record the actual parent branch HEAD SHA.
4. If the parent branch has legitimately advanced, use its latest verified HEAD and record the SHA.
5. Create or verify the isolated worktree from the parent branch.
6. Confirm the worktree is clean.
7. Confirm the active branch is `feat/issue-29-top-level-worker-navigation`.

Create one Draft PR only after all gates pass:

```text
Title:
feat(navigation): add top-level AI Worker routes

Head:
feat/issue-29-top-level-worker-navigation

Base:
feature/pr-auditor-platform-integration
```

Never target `main`.

---

## 4. Required Navigation Architecture

The application header must contain two separate navigation groups.

### Worker Navigation

Immediately after the platform brand area:

```text
PR Creator | PR Auditor
```

Requirements:

* Use router-aware links, not local button state.
* Active Worker state must follow the current route.
* Direct URL navigation must work.
* Browser refresh must preserve the Worker page.
* Browser back and forward must preserve Worker route and active state.
* Future Workers must be added through a centralized navigation registration pattern.

Preferred structure, subject to actual repository conventions:

```text
frontend/src/config/workerNavigation.js
frontend/src/components/WorkerNavigation.vue
frontend/src/views/PRCreatorView.vue
frontend/src/views/PRAuditorView.vue
```

Do not create a complicated generic form abstraction. Reuse only genuinely shared visual shell components, upload primitives, status panels, and stable UI controls.

### Platform-Global Navigation

Keep these separate from Worker navigation:

```text
Health | Dashboard | Status | History | Admin
```

Do not redesign these platform-global areas.

---

## 5. Required Routes and Route Migration

Implement independent Worker routes:

```text
/workers/pr-creator
/workers/pr-auditor
```

Before implementation:

1. Inspect the existing router.
2. Inspect `App.vue`, `HomeView.vue`, navigation components, route tests, and frontend package scripts.
3. Document the existing route model.
4. Document the migration decision in `execution-plan.md`.

Route migration rules:

* Do not leave duplicated Worker launch forms in Dashboard and the new Worker routes.
* Do not redesign Dashboard.
* Preserve existing Job Detail, History, Status, Health, Admin, downloads, and authentication routes.
* Use a compatibility redirect only where necessary to preserve an existing valid launch link.
* The route must determine which Worker page renders.

---

## 6. Worker Page Boundaries

### PR Creator

Route:

```text
/workers/pr-creator
```

This page owns PR creation only.

It must retain internal PR Creator modes:

```text
MW PR
RAN PR
```

It may expose relevant existing PR creation controls, including:

```text
iEPMS Export
BOM
EPMS
Site mode
Task Type
TSS / TI
Standard PR
General Item
Project selection
Create Job
```

It must not show PR Auditor upload controls or Audit-specific actions.

### PR Auditor

Route:

```text
/workers/pr-auditor
```

This page owns PO auditing only.

It must show only:

```text
Final PO Upload
EPMS Upload
PR Model Upload
Run Audit
```

It must show this notice, or wording with identical business meaning:

```text
PR Auditor reviews submitted PO data against configured audit rules.
It does not create or modify PR or ECC records.
Audit findings require business review.
```

It must not show any of the following:

```text
MW PR Worker button
RAN PR Worker button
PR Auditor worker selector
Site mode
Single site / All sites
Task Type
BOM
TSS / TI
Standard PR
General Item
Project selector
Create PR
ECC
PR generation wording
```

Remove the current cross-worker selector from Launch Configuration.

---

## 7. Scope Control

### In Scope

```text
Frontend navigation architecture
Router configuration
Header Worker navigation
PR Creator page extraction
PR Auditor page extraction
Worker active state
Route compatibility
Frontend unit tests
Route smoke tests
Browser UAT
Mission documentation
```

### Explicitly Out of Scope

Do not implement or fix:

```text
Issue #30
Issue #31
Issue #32
Issue #33
```

Do not modify:

```text
PR Auditor engine pin status
PR Auditor engine business logic
PR Auditor backend execution adapter
MW PR backend behavior
RAN PR backend behavior
Worker queue semantics
Job lifecycle semantics
Cancellation semantics
History backend query logic
Download backend logic
Firebase persistence contracts
Submodule pointers
Engine repositories
```

Do not run the PR Auditor engine. It remains intentionally fail-closed.

Do not commit:

```text
Production workbooks
Synthetic UAT workbooks
Generated audit reports
Runtime storage
ZIP files
node_modules
dist
.env
Business-data logs
```

Do not use files under this directory as committed fixtures:

```text
C:\dev\PR-Auditor-UAT
```

Expected code changes are frontend-focused. Backend changes are prohibited unless a minimal route compatibility dependency is unavoidable. Any exception must be recorded in `decision-log.md` before implementation.

---

## 8. Persistent Mission State

Maintain these files inside the feature branch:

```text
docs/issue-29-worker-navigation/
├─ MASTER_PROMPT.md
├─ autonomous-run-state.json
├─ autonomous-run-state.md
├─ execution-plan.md
├─ decision-log.md
├─ verification-log.md
├─ review-findings.md
├─ final-report.md
└─ COMPLETED
```

Copy this Master Prompt into:

```text
docs/issue-29-worker-navigation/MASTER_PROMPT.md
```

The state file must include at least:

```text
completed
acceptance_status
current_phase
next_action
source_branch
source_commit
feature_branch
last_verified_step
remaining_gates
draft_pr_url
```

Use persistent state as the recovery source of truth.

---

## 9. Autonomous Execution Sequence

### Phase 0 — Baseline and Discovery

1. Verify branch, worktree, and source SHA.
2. Inspect routing, current Worker form ownership, App shell, tests, and package scripts.
3. Run the existing frontend test suite before changes.
4. Record baseline results.
5. Write the route migration decision.
6. Commit the documentation baseline checkpoint.

### Phase 1 — Navigation and Routing Foundation

1. Add centralized Worker navigation metadata or equivalent registry.
2. Add route-aware top-level Worker navigation.
3. Keep global platform navigation separate.
4. Add the two Worker routes.
5. Add only minimal route compatibility behavior.

### Phase 2 — Separate Worker Pages

1. Extract PR Creator into its own route-owned page.
2. Keep MW PR and RAN PR as PR Creator internal modes.
3. Extract PR Auditor into its own route-owned page.
4. Remove the cross-worker selector.
5. Reuse stable shared components only.
6. Do not change backend behavior.

### Phase 3 — Automated Tests

Add or update frontend tests for:

```text
Direct navigation to /workers/pr-creator
Direct navigation to /workers/pr-auditor
Header active Worker state
Refresh-compatible route behavior
Back/forward-compatible route behavior where testable
PR Creator retains MW/RAN modes
PR Creator excludes PR Auditor uploads
PR Auditor includes only Final PO, EPMS, PR Model, and Run Audit
PR Auditor excludes all prohibited PR Creator controls and wording
Global platform routes remain reachable
```

Do not weaken existing tests.

### Phase 4 — Verification and Browser UAT

Run and record:

```text
Frontend unit test suite
Frontend production build
Route smoke test
git diff --check
Changed-file review
```

Use this isolated local UAT configuration only for browser verification:

```text
Backend:
http://127.0.0.1:8010

Frontend:
http://127.0.0.1:3010

Firebase:
FIREBASE_DB_MOCK=true

Storage:
C:\dev\PR-Auditor-UAT\runtime-storage
```

Do not execute the PR Auditor engine.

---

## 10. Mandatory Browser UAT

### PR Creator

```text
Open /workers/pr-creator.
Confirm PR Creator is active in Worker navigation.
Confirm MW PR and RAN PR are internal modes.
Confirm PR Auditor uploads do not appear.
Confirm existing MW/RAN controls remain available.
```

### PR Auditor

```text
Open /workers/pr-auditor.
Confirm PR Auditor is active in Worker navigation.
Confirm only Final PO, EPMS, PR Model, and Run Audit appear.
Confirm no internal Worker selector appears.
Confirm no MW/RAN, Site mode, BOM, Task Type, TSS/TI, Project,
General Item, ECC, or Create PR wording appears.
Refresh and confirm PR Auditor remains active.
Use browser back/forward between Workers and confirm active state follows route.
```

### Global Navigation

```text
Open Health, Dashboard, Status, History, Admin, and an existing Job Detail route.
Confirm all remain reachable.
Confirm Worker launch forms are not duplicated on global pages.
```

Do not mark browser UAT as passed unless it actually runs.

---

## 11. Verification Gates

Do not open the Draft PR until all items pass:

```text
[ ] Branch starts from feature/pr-auditor-platform-integration, not main.
[ ] Baseline frontend tests passed before changes.
[ ] PR Creator and PR Auditor have independent routes.
[ ] Direct navigation to both Worker routes works.
[ ] Refresh works for both Worker routes.
[ ] Back/forward preserves Worker route and active state.
[ ] Header active state follows the route.
[ ] PR Creator contains MW/RAN only as internal modes.
[ ] PR Auditor has no cross-worker selector.
[ ] PR Auditor exposes only Final PO, EPMS, PR Model, and Run Audit.
[ ] PR Auditor has no prohibited PR Creator controls or wording.
[ ] Global routes remain available.
[ ] Frontend unit suite passes.
[ ] Frontend production build passes.
[ ] Route smoke test passes.
[ ] Browser UAT passes.
[ ] git diff --check passes.
[ ] Changed-file review passes.
[ ] No UAT files, generated outputs, engine changes, or unrelated backend changes exist.
[ ] Worktree is clean after final checkpoint.
```

If a mandatory gate cannot run, record the blocker truthfully. Do not falsely mark the mission complete or open the Draft PR as completed work.

---

## 12. Git and Review Discipline

Before each checkpoint:

```text
git status --short
git diff --check
git diff --stat
```

Before opening the Draft PR:

```text
git status --short
git branch --show-current
git log --oneline feature/pr-auditor-platform-integration..HEAD
git diff --name-only feature/pr-auditor-platform-integration...HEAD
git diff --check feature/pr-auditor-platform-integration...HEAD
git submodule status --recursive
```

Perform a changed-file self-review and record findings in:

```text
docs/issue-29-worker-navigation/review-findings.md
```

Use small, coherent, verified Git checkpoints.

---

## 13. Recovery and Heartbeat Rules

On every wake-up or heartbeat:

1. Read this Master Prompt from the repository documentation copy.
2. Read `autonomous-run-state.json`.
3. Check whether the existing `/goal` is paused or incomplete.
4. Resume the same `/goal`; do not create a duplicate mission.
5. If `completed=true` and `COMPLETED` exists, make no changes and respond only:

```text
NO_OP_COMPLETED
```

6. Otherwise, complete exactly one bounded implementation or verification step.
7. Verify that step.
8. Update state and logs.
9. Create a checkpoint only when intended verified changes exist.
10. Report current phase, completed action, next action, remaining gates, and blockers.

When an ambiguity is non-security and non-scope-breaking:

1. Choose the most backward-compatible solution.
2. Record the assumption and rationale in `decision-log.md`.
3. Continue without waiting for clarification.

---

## 14. Final Draft PR

Only after every required gate passes:

1. Complete `final-report.md`.
2. Set:

```text
completed=true
acceptance_status=passed
next_action=NO_OP_COMPLETED
```

3. Create `COMPLETED`.
4. Commit and push the feature branch.
5. Open exactly one Draft PR.

Required title:

```text
feat(navigation): add top-level AI Worker routes
```

Required base branch:

```text
feature/pr-auditor-platform-integration
```

The PR body must include:

```text
Architecture summary
Route migration decision
Worker navigation registry approach
Proof of PR Creator / PR Auditor separation
Automated test and build results
Browser UAT results
Confirmation that PR Auditor engine safety gate remains untouched
Confirmation that no engine run, merge, deployment, or main-branch change occurred
Known limitations, only when real and verified
```

Stop after the Draft PR is open.

Never merge.
Never deploy.
Never modify main.
Never change the PR Auditor engine safety gate.
