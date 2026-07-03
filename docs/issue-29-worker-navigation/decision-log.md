# Decision Log

## 2026-07-03

1. Baseline decision: use `origin/feature/pr-auditor-platform-integration` at `4c904e821be63a80990a1ca2b176bcd680798b85` as the mission source baseline rather than `main`, because this issue must stack on Draft PR #28.
2. Isolation decision: create the dedicated worktree at `C:\dev\ai-worker-platform-worker-navigation` on branch `feat/issue-29-top-level-worker-navigation` so this mission stays isolated from the parent branch and other active worktrees.
3. Automation decision: create exactly one heartbeat automation named `issue-29-worker-navigation-hourly-follow-up` attached to this thread, instead of a detached cron automation, because the mission should resume the same `/goal` with local workspace context.
4. Route migration decision: make `/workers/pr-creator` and `/workers/pr-auditor` the authoritative worker routes and use `/` as a compatibility redirect to `/workers/pr-creator`, because this preserves the existing launch entry path without duplicating worker forms on a second dashboard-like page.
5. Frontend-boundary decision: keep this mission frontend-focused unless a minimal route compatibility dependency proves unavoidable; no backend or engine changes are planned at baseline.
