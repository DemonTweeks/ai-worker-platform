# Architecture

Express owns upload transport, approved package integrity, native Python subprocess lifecycle, isolated storage, metadata and downloads. Vue renders the manifest, not BOM rules. `genericSkillRunner` invokes `src/main.py --input-manifest`; that adapter calls `tx_bom_batch.process_batch` with explicit job-local EPMS/config/site IDs/output/progress. Engine modules remain skill-owned.

Root config: `txBomGeneratorRoot`, env `TX_BOM_GENERATOR_ROOT`, default `./skills/tx-bom-generator`. Interpreter: existing generic `PYTHON_EXECUTABLE` selection. No backend import of Python modules, GUI/EXE automation, shared input/template default or extra skill worktree.
