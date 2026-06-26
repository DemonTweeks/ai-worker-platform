# RAN Golden Test Evidence

## 2026-06-26 - First Golden Business-Result Verification

- Command:
  - `npm.cmd --prefix backend run test:ran-golden`
- Reference inputs:
  - `skills/create-pr-cd-ran/input/BOM.xlsx`
  - `skills/create-pr-cd-ran/input/EPMS.xlsx`
- Reference outputs:
  - `skills/create-pr-cd-ran/output/ECC_PR_Output.xlsx`
  - `skills/create-pr-cd-ran/output/ECC_PR_Output_With_GeneralItems.xlsx`
- General Item project used:
  - `CD consolidation 2023 (Swap/ Modernize)`

### Standard PR Result

- Platform job status: `completed`
- Platform job ID: `PR-20260626-026`
- Compared logical workbook content against upstream `ECC_PR_Output.xlsx`
- Verified:
  - sheet names: `ECC_PR`
  - header row: exact match
  - row count: `52786`
  - unique `PBOM Code*` values: `67`
  - summed `Quantity*`: `66678`
  - General Item rows: `0`
  - first data row: exact match
  - last data row: exact match
  - full logical row set: exact match

### General Item Result

- Platform job status: `completed`
- Platform job ID: `PR-20260626-027`
- Compared logical workbook content against upstream `ECC_PR_Output_With_GeneralItems.xlsx`
- Verified:
  - sheet names: `ECC_PR`
  - header row: exact match
  - row count: `105390`
  - unique `PBOM Code*` values: `126`
  - summed `Quantity*`: `119282`
  - rows whose `Remarks` include `General`: `52604`
  - first data row: exact match
  - last data row: exact match
  - full logical row set: exact match

### Notes

- The verification compares workbook business content, not raw Excel binaries.
- The script also verifies both runs produce platform-owned `Summary.json` and ZIP outputs before performing workbook comparisons.
