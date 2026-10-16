# Create PR CD RAN - Architecture

`src/main.py --input-manifest` validates the schema/files/parameters, copies packaged configuration into the isolated workspace, then supervises normalization -> calculation -> PR generation -> ECC export. It declares checksummed approved outputs and builds `CREATE_PR_CD_RAN_DELIVERY.zip` in Python. Legacy `api/app.py`/desktop launchers are not the platform path.

Runtime assets include MainConfig.xlsx, ReferenceSubcon&Region.xlsx, General Item project catalogue and ECC template. These ship inside the reviewed package; platform admin business-asset editing is not a substitute for a skill release. `selectedProject` comes from the catalogue, not arbitrary UI text.

The wrapper emits NDJSON phase/heartbeat events, checks the cancellation sentinel and supervises child termination. Timeout is 3,600 seconds. Input/result paths remain workspace-contained; declared input size/hash and output checksums are checked. Error-publication caveats are in [Pending](PENDING.md).

Sources: `skill.json`, `src/main.py`, `src/simple_normalize.py`, `src/simple_calculation.py`, `src/simple_pr_generator.py`, `src/simple_ecc_export.py`, `tests/test_skill_contract.py`.
