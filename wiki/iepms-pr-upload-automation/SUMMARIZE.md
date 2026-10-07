# iEPMS PR Upload

The platform exposes the draft-only wrapper from `Gumb-D/iepms-pr-upload-automation`, branch `migration/zx01-pc`.

Upload one ECC `.xlsx` workbook and one separate attachment, then choose project, TSS/TI, DU model, planned start date, and the two Y/N flags. The Python skill prepares and verifies a draft through Step 20 and returns its PSQ. Submit, trackers, and Implementation Plan are excluded from this operation.

Open `/#/workers/iepms-pr-upload` locally or `/fe/#/workers/iepms-pr-upload` in production. Authentication requires an existing signed-in Chrome CDP browser on the backend host and corporate network access.

The platform owns transport and job lifecycle. The skill owns workbook validation, signed API calls, recovery, duplicate handling, and draft verification. Live operation has not been exercised by the platform integration tests.
