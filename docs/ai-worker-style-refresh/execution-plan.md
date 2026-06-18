# Execution Plan

This plan is intentionally resumable. Each automation wake-up should execute one bounded phase or subphase, update state and logs, commit meaningful tracked changes, then stop.

## Phases

1. Setup isolated worktree and initialize persistent run state.
2. Inspect AI Worker repository structure, frontend architecture, test scripts, and reference analysis.
3. Decide adaptation principles and implementation targets without changing routes, backend behavior, business logic, or submodules.
4. Implement style/layout refresh incrementally in frontend-only surfaces unless inspection proves a broader change is required.
5. Run focused checks and baseline frontend tests.
6. Run backend baseline tests with `C:\dev\ai-worker-platform\.venv\Scripts\python.exe` available for Python-dependent checks.
7. Perform browser route checks for required routes and viewport checks.
8. Capture or document before/after visual evidence.
9. Perform code review, record findings, and resolve or explicitly close them.
10. Run final verification gates, write final report, confirm no push/merge/deploy, create `COMPLETED`, and set `completed=true`.

## Next Bounded Phase

Inspect the repository and reference analysis, then refine this plan with concrete files, commands, and visual decisions.
