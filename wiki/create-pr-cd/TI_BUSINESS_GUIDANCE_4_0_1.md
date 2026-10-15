# MW TI business guidance v4.0.1

- Skill commit: `dc7cb77d656a367c0563c169271f784b15e7d287`.
- Built on current MW main `237ee81`, retaining its Backoffice changes.
- Runtime approval: version `4.0.1`, normalized SHA-256 `9a0f4331f67f60ac654cad640db386f203edd9047e81096136f254c0ab639db6` (115 files).
- Platform integration updates only the MW submodule pin and its approval; existing iEPMS v0.3.1 integration is retained.

## Behaviour

- Terminal PostMOCN site-ID aliases normalize to `_POSTMOCN`, preserving numbered instances and source identity. Aliases that collide fail closed. Tx SOW and source-column precedence are unchanged.
- Approved Starlink-only dismantle work does not require MW antenna size. Separate MW components still require evidence; mixed migration remains atomic.
- Approved deterministic NLOS evidence resolves 0.3m, not a universal missing-size fallback. Explicit contradictions/invalid/uncertain evidence remain review-required with a precise reason and source diagnostics.
- Existing TX Rollout TX/NE/FE detail mappings are wired under prior Issue #50 Batch 2 / #80 business approval. Strict header gates and absent direct/BOQ mappings are unchanged.
- NLOS size does not invent antenna count: ambiguous 2-versus-4-antenna reroute dismantle model selection still requires review.

## Validation / release status

- Dedicated guidance file: 24 tests passed; 4 subtests passed.
- Full Python suite: 858 passed, 20 skipped, 380 subtests passed; five failures also reproduce on unchanged MW main `237ee81` (Windows path/mock and immutable rollback artifact issues).
- TX Rollout discovery packet, historical headers and profile traceability checks pass.
- Platform fingerprint normalization, generic catalog/submission/result contracts, and local offline Python runner pass.
- The seven reported production workbooks are not available, so no claim of replaying those exact cases.
- Local commits only: not deployed, not submitted to live iEPMS, no tracker updates.

See `skills/create-pr-cd/docs/TI_BUSINESS_GUIDANCE_4_0_1.md` for scope and limitations.
