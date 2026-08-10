# Issue #88 Business-Facing Status Copy Design

## Goal

Replace technical reconciliation terminology in the user interface with business-readable wording while preserving existing backend/internal fields and error codes.

## Approved UI language

- Internal `RESULT_RECONCILIATION_INCOMPLETE` remains unchanged.
- Internal `unaccountedSiteCount` remains unchanged.
- A failed job caused specifically by `RESULT_RECONCILIATION_INCOMPLETE` is presented to users as **Incomplete Result**, not generic **Failed**.
- `Unaccounted Sites` is presented as **Sites Without Confirmed Result**.
- User explanation format: `8 of 24 requested sites generated. 16 sites have no confirmed result.`
- Normal execution failures, timeouts, crashes, and other failures continue to display **Failed**.

## Surfaces

Apply consistently to:
- History status badge and reconciliation metadata;
- Job Detail status and reconciliation metadata;
- PR Creator Result Delivery reconciliation metadata/message;
- Issue #88 frontend regression tests.

## Non-goals

- Do not rename backend fields.
- Do not rename the technical error code.
- Do not change reconciliation arithmetic or lifecycle persistence.
- Do not change PR Auditor presentation.
