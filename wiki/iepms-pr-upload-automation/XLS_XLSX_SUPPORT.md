# iEPMS ECC XLS / XLSX support — local implementation

## Behavior
- Required ECC input accepts .xls and .xlsx (case-insensitive).
- Genuine BIFF/OLE .xls uses xlrd>=2.0.1,<3; OOXML .xlsx uses openpyxl.
- Original uploaded bytes are preserved; no rename or lossy conversion.
- Shared reader used for manifest rows, batch validation, abnormal-quantity Remarks and discovery.
- Existing required columns, quantity, region/vendor and Remarks validation remain enforced.
- Integral numeric identifiers normalize without a trailing .0; text leading zeroes are retained.
- Excel error cells, misleading extensions, malformed files and boolean identifiers are rejected.
- No formula recalculation; saved formula results must be valid.

## Integration
- Skill version is 0.3.1 in the working tree.
- Platform approved version and package fingerprint updated.
- Frontend already derives accepted formats from the skill catalog; no UI runtime fork was needed.
- Runtime dependency xlrd 2.0.2 installed in the current Python environment; pytest/xlwt are test-only.

## Verified offline
- Skill Python suite: 182 passed, socket connections blocked.
- Frontend: 95 unit tests passed.
- Backend generic skill contract: both genuine XLS/XLSX fixtures accepted; CSV rejected.
- Backend iEPMS offline runner: both formats reach expected auth-required failure, no submission.
- Engine integrity and cross-platform skill fingerprint tests passed.

## Release and deployment
Skill implementation is published on main at 397010e842ec8546b8d06351b463657b31de1182 (version 0.3.1). This platform change pins that exact commit and retains the reviewed approval fingerprint.

Deployment steps:
1. Pull the platform release and run git submodule update --init --recursive.
2. Install the skill requirements in the actual deployment Python environment (including xlrd).
3. Restart the backend to reload its in-memory approval JSON; reload the UI/catalog. Use the normal frontend build step when deploying.

No live server XLS attachment/import has been exercised, no services restarted and no PR submitted by this change. Existing running backend processes may still hold the old approval table and need restarting before using this revised package.