# Handover and private-submodule access

## Local development

Development worktree `C:\Development\ai-worker-platform-dev01`, branch `dev01`.
Production checkout `C:\deployment\ai-worker-platform`, branch `main`, deployed `6186a05`.
TX BOM private skill main is published at `50a85eebed450d8ca50f07d42e3e1fa1463cc54c`;
submodules use exact pins, normally detached HEAD, not a development branch tip.
The old TX BOM worktree was removed; evidence was archived. See [current platform snapshot](../PLATFORM_REALIGNMENT_DEV01.md).

Authenticate a Git identity with read access to private `BL2ZteSolution/tx-bom-generator`; deployment automation needs its own least-privilege repository access. Never place tokens in `.gitmodules`, environment examples, logs or documentation. After approved commits are published:

```powershell
git submodule sync --recursive
git submodule update --init --recursive
# Runtime comes from the recorded gitlink, not `submodule update --remote`.
C:\Python314\python.exe -m pip install -r skills/tx-bom-generator/requirements.txt
```

`TX_BOM_GENERATOR_ROOT` can override package location; approved package/version must still match. Pin skill revision first, then platform gitlink and normalised runtime fingerprint. No engine/config workbook data is embedded in this skill.

## Validation commands

```powershell
# Skill root
C:\Python314\python.exe -m unittest discover -s tests -v
# Platform backend, isolated mock environment/storage with base folders initialised
$env:PYTHON_EXECUTABLE='C:\Python314\python.exe'
$env:FIREBASE_DB_MOCK='true'; $env:LLM_ENABLED='false'
npm test
# Platform frontend
npm test
```

The TX BOM offline test retains synthetic job artifacts under command-center/runtime/tx-bom-acceptance-* (ignored by Git). It exercises real multipart HTTP, native Python runner, downloads, cross-job download denial, simultaneous isolated subprocesses, mixed/all-failed outputs, real queued/claimed cancellation decisions, and generic hard timeout using a test-only sleeper. Queue scheduling is stubbed for deterministic test ownership; durable scheduling has its existing regression suite.

Final version/fingerprint/test evidence and exact skill revision belong in command-center/results/acceptance.md. Tests do not constitute merge/deployment authorisation.
