# Business Logic

Business behavior is implemented in the skill repository's existing `iepms_pr_upload` package.

1. Read the ECC `details` sheet and validate required purchasing-area, region, site, DU, contract, subcontractor, PBOM, SOW, unit, and positive quantity data.
2. Validate the selected project and DU model. Malaysia CelcomDigi Project supports `2023 TX Rollout` and `TX Mini Project`; CelcomDigi MW supports `MW EOS Swap` and `ZTE TX MINI`. Validate TI/TSS scope and the planned date.
3. Bind project settings and SHA-256 file identities into an immutable request snapshot. Acquire the shared OS worker lock and recover an existing execution when appropriate.
4. Bootstrap the existing authenticated Chrome session and reuse the skill's signed direct-API backend.
5. Prepare/recover the draft, import ECC lines, inspect line exceptions and duplicate dispatch, apply the existing controlled remediation, attach evidence, configure reviewers, and save the final description.
6. Verify the fresh pre-submit gate. Return a verified PSQ only after the complete draft-only workflow succeeds.

Submit and all downstream tracker/Implementation Plan operations are structurally excluded by the existing `prepare_only`/`stop_before_submit` path. A known PSQ on failure is evidence of an existing draft, not proof of completion. An uncertain mutation must be reconciled through the retained execution state rather than replaced with a new draft.

The platform treats this behavior as one Python invocation and does not interpret or reproduce the domain rules.
