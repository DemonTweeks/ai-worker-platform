# Runtime environment profiles

This directory is the only environment-file location used by the platform. Each profile contains both backend variables and frontend `VITE_*` variables.

Create ignored runtime files from the tracked templates:

```powershell
Copy-Item config\env\local.env.example config\env\local.env
Copy-Item config\env\production.env.example config\env\production.env
```

`local.env` and `production.env` are intentionally ignored. Never commit API keys, Firebase credentials, administrator passwords, JWT secrets, or other live credentials.

The backend and Vite select the file through `AI_WORKER_PROFILE=local|production`. Production launch scripts always select `production`. Direct local-development commands default to `local` unless the variable is already set.

Production startup requires `AI_WORKER_MACHINE_ID`, `FIREBASE_DB_URL`, `ADMIN_DEFAULT_PASSWORD`, and `JWT_SECRET`. It also requires `LLM_API_KEY` when `LLM_ENABLED=true`.

The iEPMS draft skill uses `IEPMS_PR_UPLOAD_ROOT`, optional `IEPMS_PR_UPLOAD_CDP_PORT`, and optional absolute `IEPMS_PR_UPLOAD_RUNTIME_ROOT` from this same selected file. A blank runtime root uses the skill's persistent `runtime/jobs/wrapper` directory; a blank port probes 19229, 19222, and 19223. Every wrapper instance on the host must share the runtime root. The backend host needs a signed-in iEPMS Chrome session and corporate connectivity. Browser credentials are acquired by the skill and are never entered into the web form or these tracked examples.
