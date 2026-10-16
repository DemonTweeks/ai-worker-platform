# tx-pr-auditor â€” Skill Contract

## Identity

| Field | Value |
| --- | --- |
| Skill ID | `tx-pr-auditor` |
| Version | `1.1.0` |
| Entrypoint | `src/main.py` |
| Manifest/result schema | `1.0` |
| Generator dependency | `create-pr-cd` 4.0.0 |
| Generator scopes | TSS, then TI |
| Timeout | 3,600 seconds |

## Input

- `final_po`: exactly one `.xlsx`, maximum 200 MiB.
- `epms`: exactly one `.xlsx` or `.xlsm`, maximum 200 MiB.
- `filterYear`: optional integer 2000â€“2200.
- `filterMonth`: optional integer 1â€“12.
- `annotateEcc`: optional boolean, default `true`, hidden in the UI.

The audit row limit remains 10,000.

## Output

`result.json` declares the audit workbook, JSON summary, optional annotated ECC copies, safe classification metrics, and generator scope metrics. Generator review evidence is surfaced as warnings. Any audit finding or generator review requirement produces `succeeded_with_warning`.

## Standalone Command

```text
git submodule update --init --recursive
python src/main.py --input-manifest <workspace>/skill-input.json
```

The direct `scripts/audit_final_po.py` CLI remains available for focused Final PO-versus-ECC development, but it is not the public platform contract.

## Completeness, pairing and nested identity

Year/month must be supplied together; period filtering occurs after reading Final PO, not before the 10,000-record cap. Reader also stops at 1,000 consecutive blanks. Metadata is not proof of no omitted records. Cancellation sentinel is `control/cancel.requested` and checks are cooperative, including every 250 rows in key loops. Exact nested pin is `8d8880f` (v4.0.0), not the sibling MW checkout. Individual outputs plus `TX_PR_Audit_Delivery.zip` are skill-owned and checksummed.

Current audit also consumes PR-model/EPMS scope evidence and may add synthetic entitlement. This is not a claim of an ECC-only audit; see [architecture](ARCHITECTURE.md) and [pending owner review](PENDING.md).

Cancellation path precedence: platform-generated `paths.cancellation` overrides standalone defaults. Current generic platform jobs use `temp/cancel.requested`; MW/auditor manifest fallback `control/cancel.requested` does not override that envelope. Sources: `genericSkillRunner.js`, `genericSkillJobService.js`, and each Python `load_envelope`.
