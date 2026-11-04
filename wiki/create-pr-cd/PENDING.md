# create-pr-cd - Pending work

## TI case follow-up

Preserve [seven-site findings](HANDOVER.md). Approve exact EOS State/Jendela antenna source fingerprints before using previously unverified data; add governed equipment-shorthand parsing with old/new/cable/frequency safeguards; clarify new-link versus reroute/dismantling and antenna counts; resolve partial-ECC/whole-site atomicity policy. Replays need retained correct inputs, isolated workspaces and appropriate authorization. Existing PR references must not be bypassed.

## Scope and release policy

Platform contract remains TSS/TI. Direct CLI already implements Planning and Backoffice; any future platform exposure must declare required inputs and governance in Python manifest/tests. Reference overrides remain private. Review v4.0.1's documented pre-existing Windows/path/mock/rollback-artifact test failures before claiming all regression gates clean. Auditor nested-generator upgrades are separate releases, not sibling-directory changes.

No business rule belongs in a platform Node workaround. Rollback-only Node generation path remains retired.


## Production TI scope split — v4.0.2

The user-approved new-link/reroute split is implemented in the skill: clear new-link-only needs installation evidence; actual reroute additionally requires explicit old-antenna diameter and 2/4 count; unclear combined labels remain REVIEW_REQUIRED. Mandatory transport/model choices must resolve uniquely and atomically, with no partial ECC for unresolved reroute records. NLOS is not an automatic old-size/count substitute. Existing TSS and Jendela separated migration work-item routing is preserved. Earlier case findings above remain historical and are not proof of successful replay. See [release rules](TI_NEW_LINK_REROUTE_4_0_2.md).


### Existing full-suite failures reproduced on baseline (2026-11-04)

Five tests remain failing independently of this split: long-path mocked os.walk keyword compatibility on Python3.14, Windows promotion path separator assertions, and three Jendela immutable rollback SHA/readiness assertions. See [release validation](TI_NEW_LINK_REROUTE_4_0_2.md). No blanket full-suite pass or automatic historical-site clearance is claimed.


## Planning platform integration — v4.1.0

MW platform Task Type now declares Planning (`PLANNING`) alongside TSS/TI, using the existing governed engine without changing its business rules. This supersedes earlier current-scope statements that Planning is standalone-only; Backoffice remains standalone-only. [Integration, tests and release boundary](PLANNING_PLATFORM_4_1_0.md). Production activation was verified on 2026-11-04 after a frontend rebuild and service restart: Nginx serves MW 4.1.0 with TSS/TI/PLANNING and the approved fingerprint. No live Planning job or external submission was run. iEPMS PR Upload/Auditor/RAN scopes remain unchanged.
