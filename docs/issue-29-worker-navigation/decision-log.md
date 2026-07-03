# Decision Log

## 2026-07-03

1. Baseline decision: use `origin/feature/pr-auditor-platform-integration` at `4c904e821be63a80990a1ca2b176bcd680798b85` as the mission source baseline rather than `main`, because this issue must stack on Draft PR #28.
2. Isolation decision: create the dedicated worktree at `C:\dev\ai-worker-platform-worker-navigation` on branch `feat/issue-29-top-level-worker-navigation` so this mission stays isolated from the parent branch and other active worktrees.
3. Automation decision: create exactly one heartbeat automation named `issue-29-worker-navigation-hourly-follow-up` attached to this thread, instead of a detached cron automation, because the mission should resume the same `/goal` with local workspace context.
4. Route migration decision: make `/workers/pr-creator` and `/workers/pr-auditor` the authoritative worker routes and use `/` as a compatibility redirect to `/workers/pr-creator`, because this preserves the existing launch entry path without duplicating worker forms on a second dashboard-like page.
5. Frontend-boundary decision: keep this mission frontend-focused unless a minimal route compatibility dependency proves unavoidable; no backend or engine changes are planned at baseline.
6. Verification-environment decision: run browser UAT against a dedicated backend on `http://127.0.0.1:8010` and frontend on `http://127.0.0.1:3010`, because port `3010` was initially occupied by a different feature worktree and had to be replaced before authoritative validation.
7. Copy-conflict decision: keep the required PR Auditor business notice with the `PR or ECC records` wording even though the prohibited-word list also mentions `ECC`, because the prompt explicitly requires that notice text or wording with identical business meaning and the safety/business boundary is clearer with the notice retained.
8. Admin-route decision: treat `/admin/health` redirecting to `/admin/login?redirect=%2Fadmin%2Fhealth` as a passing global-route result during browser UAT, because the mission requires route availability while preserving existing authentication guards.
