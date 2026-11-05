# Legacy template headers — 0.1.1

The user-supplied reference outputs retain =COUNTA(#REF!) count formulas in A1:BF1. Version0.1.0 rejected these decorative headers during configuration inspection, stopping otherwise reproducible BOMs.

0.1.1 preserves only this exact formula/type/range, without repairing or evaluating it, and emits LEGACY_TEMPLATE_COUNT_HEADER. It is not used for configuration selection/material arithmetic. Other broken references/error cells in retained rows1-3 still fail. All quantity, mapping, source integrity and output verification checks remain.

Acceptance is semantic workbook parity: site order/metadata, BOX remarks, all material columns/codes/names/quantities and header values. File/ZIP hashes and timestamp names are not stable content identifiers; workbook formatting is not claimed byte-identical.

Private baseline: supplied release workbook has8 actual rows despite10Sites filename. Original source and candidate reproduce these8. Broader selection13/16 remains possible;3046M_AD lacks matching current configuration,1120D_GF lacks SOW,9436L is absent. Do not infer data or substitute9436L_GF automatically. No real workbooks committed or distributed.

Status: local implementation only; tests and handover record distinguish validation from deployment. No live iEPMS acceptance/import/release claimed. Existing queued0.1.0 jobs must not be silently run against a different approved identity; submit explicit new jobs after release. Roll back package and platform approval/pin together.

## Verified local acceptance
97Python tests, fullbackend Firebase/SQLite regression,117frontend tests/build/14routes passed. Two isolated API/runner/download jobs reproduced all8baseline rows; input hashes, artifacts and ZIP contents verified. Broader13/16same as original;9/10business references match materials. Local fix only, no publication/activation. See platform command-center TASK-TXBOM-011 records.

## Release authorization
User authorized commit/push/restart on 2026-11-05. Skill 0.1.1 published at 0f1d5265db26f7d11f09217abd71037096058697; platform approval fingerprint f43bd8ec061accc0d957468f2c7fde2b1e0eb49e88adda5e248db9c348a5b668. Production activation to be verified after restart. Preserve newer platform Agnes health fix b0dbef5 and existing SQLite runtime configuration. Prior local-only notes above describe pre-release validation, not current authorization.
