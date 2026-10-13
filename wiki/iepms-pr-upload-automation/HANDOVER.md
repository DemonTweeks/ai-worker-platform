# Handover

Source: `https://github.com/Gumb-D/iepms-pr-upload-automation`, branch `migration/zx01-pc`. Contract commit `f094cc1697ed8fa444ec437bcae4e21d9adbcee0` is published and pinned by the platform integration branch `agent/add-iepms-pr-upload-skill`. The adapter builds on upstream draft-wrapper commit `789bdff`.

Install dependencies into the Python interpreter used by the backend:

```powershell
.\.venv\Scripts\python.exe -m pip install -r skills\iepms-pr-upload-automation\requirements.txt
```

The production launchers already install each skill's `requirements.txt` when dependency installation is requested. They initialize pinned submodules; they do not follow branch heads automatically.

Offline checks:

```powershell
$env:PYTHONPATH = "$PWD\skills\iepms-pr-upload-automation\src"
.\.venv\Scripts\python.exe -m pytest skills\iepms-pr-upload-automation\tests -q -p no:cacheprovider
npm.cmd --prefix backend run test:iepms-skill-offline
npm.cmd --prefix backend run test:skill-contract
npm.cmd --prefix backend run test:engine-integrity
npm.cmd --prefix frontend test
```

The Python suite checks the real workflow using injected offline backends, including verified PSQ, cached reruns, ambiguous-import protection, and no Submit/downstream calls. The platform regression uses an unavailable local CDP endpoint to prevent live authentication, then verifies auth-required failure, safe reports, downloads, and cancellation restrictions.

October 7, 2026: 94 Python tests and 94 frontend tests passed. Frontend build and all 12 route-smoke URLs passed. Backend approval, registry, queue, contract, concurrency, health, and iEPMS offline execution checks passed.

For live use, the backend host needs corporate access and an interactively authenticated CDP Chrome. Use one stable runtime root across desktop/platform instances. The UI reports PSQ separately from verified/submitted state. A blocked result must not be treated as a successful draft.

Runtime changes in the skill require a newly reviewed package SHA-256 in `backend/src/skills/approvedSkills.json`. The declared include set covers the manifest, requirements, pyproject, and all Python sources; TOML line endings are normalized alongside existing text formats.
