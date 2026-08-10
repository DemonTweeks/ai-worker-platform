# create-pr-cd — Business Logic Analysis

## Purpose

This document describes the domain decisions currently owned by `create-pr-cd`. It is a refactor reference: these rules must remain inside the Python skill and must not be reimplemented by AI Worker Platform.

Sources reviewed:

- `skills/create-pr-cd/SKILL.md`
- `skills/create-pr-cd/BUSINESS_RULES.md`
- Current Python entrypoint and generation modules
- Current configuration, profile and safety-control structure

Where documentation and current execution differ, this document identifies the difference instead of treating planned behavior as implemented behavior.

## Current Capability Boundary

| Scope | Current CLI status | Notes |
| --- | --- | --- |
| TSS | Implemented | Uses SOW, profile and scope-specific selection rules |
| TI | Implemented | Uses SOW, antenna and specialized migration/reroute rules |
| Planning | Documented, not implemented in current CLI | Must not be exposed until Python implements and tests it |
| Operation Backoffice | Documented, not implemented in current CLI | Must not be exposed until Python implements and tests it |

The current entrypoint accepts exactly one execution scope, `TSS` or `TI`, per invocation.

## Decision Order

The effective business flow is:

```text
Resolve source workbook and canonical records
  -> resolve project and DU profile
  -> apply profile lifecycle gate
  -> select requested site population
  -> apply subcontractor policy exclusions
  -> apply approved-no-output SOW decisions
  -> apply canonical input readiness
  -> apply scope eligibility and duplicate rules
  -> resolve approved contract data
  -> select mandatory PR-model items
  -> partition eligible, ignored, duplicate and review-required records
  -> generate ECC and evidence reports
```

Earlier decisions constrain later decisions. A later model match must not override a lifecycle rejection, policy exclusion or approved no-output decision.

## 1. Profile and Run-Mode Gate

The resolved DU profile controls whether ECC generation is allowed.

| Profile state | Formal production | Explicit non-production UAT |
| --- | --- | --- |
| `PRODUCTION` | Allowed | Allowed when explicitly requested |
| `PR_INPUT_READY` | Blocked | Allowed for business validation |
| Earlier/unapproved lifecycle state | Blocked | Blocked |
| `DEPRECATED` | Blocked | Blocked |

Profile notes cannot promote a profile. The structured profile status is authoritative.

Non-production UAT outputs must be visibly marked and isolated under a run-specific directory. They must never be presented as formal ECC.

## 2. Site Selection

Exactly one selection mode is required:

- All canonical records; or
- One or more explicit site codes.

If both or neither are supplied, execution fails. If a requested site code does not exist in the canonical input, execution fails with the missing codes identified. Selection occurs before scope generation.

## 3. Eligibility and Partitioning

Each selected record is assigned to one of these business partitions:

| Partition | Meaning |
| --- | --- |
| `candidates` | Passed current pre-contract generation checks |
| `duplicates` | Existing PR state blocks generation |
| `ignored` | No scope work is required or an approved rule produces no output |
| `review_required` | The skill cannot safely generate without human resolution |

### Subcontractor policy

An approved exclusion rule may classify a scope/site as ignored before generation. A missing scope-specific subcontractor is ignored because there is no recipient for that scope.

### Approved no-output SOW

An `APPROVED_NO_OUTPUT` SOW normalization is a hard stop. It outranks other eligibility, including an otherwise-approved Jendela migration decision.

### Canonical input readiness

A record must normally be `PR_INPUT_READY` and have an approved SOW normalization. Unready or unapproved values become review-required rather than being guessed.

An approved Jendela TI migration decision may satisfy the TI routing condition defined by its profile, except when the SOW is explicitly approved for no output.

## 4. Scope Triggers and Existing PR Rules

### TSS

The documented general rule requires a non-blank TSS subcontractor and no existing TSS PR reference.

Current orchestration contains an intentional nuance: TSS entitlement can remain available even when an existing TSS PR is present so downstream Final PO audit comparison can use it. This differs from a universal “existing PR always blocks generation” statement and must be resolved explicitly before refactoring.

### TI

TI requires a non-blank TI subcontractor.

- Existing TI PR reference -> `DUPLICATE_BLOCKED`.
- Approved status stating PR is not required -> ignored.
- Otherwise continue through readiness and model matching.

This current TI behavior is explicit in the record partitioning logic.

## 5. Primary SOW Selection

`Tx SOW` is normalized through the skill-owned registry. When a source value contains multiple recognizable SOWs, the documented rule selects the first recognized primary SOW and does not generate secondary SOWs automatically.

Unknown, unapproved or ambiguous normalization must not be guessed. It becomes no-output or review-required according to the registry decision.

## 6. TSS Model Matching

TSS normally matches mandatory PR-model rows using the primary SOW. Antenna size is not a general TSS key.

Business inputs may additionally include:

- `TX Upgrade Scope` for scenario selection.
- Site ID patterns for LOS survey selection.
- Profile-specific geography or hardware-upgrade evidence.

Only mandatory and deterministically selected items may be generated. Multiple unresolved matches become review-required.

### MW New Link / Reroute

This scenario has specific precedence rules:

1. `Tx SOW` must resolve to `MW New Link / Reroute`.
2. If `TX Upgrade Scope` contains `dismantle` case-insensitively, classify as Reroute; otherwise classify as New Link.
3. Use PR-model `Remarks` as the primary New Link/Reroute filter.
4. Apply the LOS survey exception for model rows without distinguishing remarks.

| Scenario | Site pattern | LOS survey PBOM |
| --- | --- | --- |
| New Link | Any | `350000062773` |
| Reroute | Site ID contains `_LOS` | `350000062776` |
| Reroute | Site ID does not contain `_LOS` | `350000062773` |

Quantity override for PBOM `350000589343` and `350000589344`:

| Scenario | Required quantity |
| --- | ---: |
| New Link | 1.0 hop |
| Reroute | 1.5 hop |

This scenario-specific quantity overrides the broad “TSS quantity is 1” rule. Incorrect duplicate model rows are filtered out; duplicate PBOMs must not survive in the final selection.

### MW Hardware Upgrade

The approved model contains a mandatory choose-one decision. Source evidence determines the unique IDU/ODU upgrade subtype. If evidence indicates multiple incompatible subtypes or no unique subtype, the result becomes review-required.

The selected item's code, quantity and mandatory metadata come from the PR model rather than being invented by the selector.

## 7. TI Model Matching

TI uses the primary SOW plus antenna evidence. General antenna inputs are the NE and FE antenna-size fields.

Documented base rule:

- Both sides populated and equal -> use that size.
- Both sides populated and different -> use the larger size.
- One or both sides missing -> review-required.

Supported categories documented by the skill include 0.3 m, 0.6 m, 1.2 m, 1.8 m and 2.4 m model groups.

The skill selects mandatory TI items and resolves approved choose-one groups. No mandatory match, no antenna-group match or an ambiguous match produces review-required evidence.

### TI duplicate prevention

Existing or waived TI PR states are removed before model generation and reported as duplicate or ignored outcomes.

### MW Reroute TI

Reroute can require separate install and dismantle antenna items. The skill must resolve both sides from source evidence.

Review-required examples:

- Install antenna size missing.
- Dismantle antenna size missing.
- Dismantle antenna size ambiguous.
- Install or dismantle PR-model item not matched.

### MW Re-engineering

Current documentation states that MW Re-engineering remains review-required until confirmed business rules exist. It must not be automatically inferred during platform refactoring.

## 8. Contract and Purchasing Data

The skill resolves contract information from its approved reference data.

- Contract number is matched by normalized subcontractor.
- Purchasing area is resolved from approved mapping/profile behavior.
- Blank, placeholder or conflicting reference entries are invalid.
- Missing approved mapping fails closed or becomes review-required.
- Fuzzy normalization must not silently create or alter an approved mapping.

Reference mappings are business assets owned and versioned by the skill.

## 9. Mandatory Item Policy

- Generate mandatory line items only.
- Do not automatically generate optional transportation or other optional rows.
- A mandatory choose-one group requires a deterministic, approved selector.
- Multiple possible mandatory choices without a rule become review-required.
- PBOM, description, unit and quantity must come from an approved model row or an explicitly approved fixed rule.

## 10. Review, Ignore and Failure Policy

The skill must not silently guess.

Typical review-required conditions:

- Canonical input is not ready.
- SOW normalization is not approved.
- Contract or purchasing data cannot be safely resolved.
- Multiple PR-model rows remain ambiguous.
- Mandatory choose-one selection is unresolved.
- TI antenna evidence is missing or ambiguous.
- Route/material selection is missing or duplicated.
- Profile-specific technical evidence conflicts.

Current runtime separates review-required records from generation candidates and writes review evidence. Older/general documentation also describes writing incomplete rows into ECC with `REVIEW_REQUIRED` remarks. This difference must be settled through golden current behavior before contract migration; the platform must not choose between the policies.

## 11. ECC Output Rules

For generated candidate rows:

- Use the skill-owned ECC template and `details` worksheet contract.
- Preserve sequential `SN.` values per output file.
- Populate approved purchasing area, region, site, DU, contract, subcontractor, PBOM, SOW, unit and quantity fields.
- Group output by the skill's resolved scope, subcontractor, region and DU-model naming rules.
- Limit each file to 30 unique sites and create numbered parts when needed.
- Use skill-owned production/UAT naming and directory isolation.

The exact workbook columns, filenames and grouping are domain output rules, not platform conventions.

## 12. Documented Future Rules

Planning and Operation Backoffice logic exists in skill documentation, including fixed Planning PBOM behavior and Allstar Operation Backoffice behavior. These rules are not current CLI capabilities and are excluded from the active runtime contract.

When implemented, they must be added in Python, covered by golden tests and declared in a new approved skill version. The platform should require no scope-specific code change.

## 13. Refactor Invariants

The thin-wrapper refactor is correct only if:

- Current profile and UAT gates remain unchanged.
- Approved no-output decisions retain precedence.
- TSS/TI candidate, ignored, duplicate and review populations remain equivalent.
- Scenario-specific PBOM and quantities remain equivalent.
- Ambiguous cases remain fail-closed.
- ECC content, grouping, splitting and naming remain equivalent.
- The platform does not parse or reinterpret any of these rules.

## 14. Business Decisions Still Required

- Confirm whether existing TSS PR references should block normal generation or remain available specifically for audit entitlement.
- Confirm whether review-required rows belong inside an ECC workbook, only in review reports, or vary by reason/profile.
- Confirm whether reference-asset overrides are supported production behavior.
- Confirm formal rules for MW Re-engineering.
- Implement and approve Planning and Operation Backoffice before advertising them.
