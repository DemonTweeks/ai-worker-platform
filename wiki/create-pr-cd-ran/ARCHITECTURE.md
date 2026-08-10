# Create PR CD RAN - Architecture

`create-pr-cd-ran` is a standalone Python skill behind the platform contract. The platform supplies a BOM, EPMS workbook, `runMode`, and optional `selectedProject`. The wrapper validates declared file identity, prepares an isolated config snapshot, runs the four Python stages, and declares checksummed outputs in `result.json`.

```text
BOM + EPMS + parameters
  -> simple_normalize.py
  -> simple_calculation.py
  -> simple_pr_generator.py
  -> simple_ecc_export.py
  -> JSON and ECC workbook outputs
```
