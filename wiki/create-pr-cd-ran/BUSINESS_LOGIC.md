# Create PR CD RAN - Business logic

1. Validate XLSX BOM/EPMS, source identity and requested mode before generation.
2. Normalize the existing source representations using skill-owned configuration.
3. Apply MainConfig item/condition keys, condition values, thresholds, divisors and rounding; `RoundMode=UP` means ceiling. Feeder/run rules deliberately use original normalized quantities, not previously calculated values.
4. Generate standard PR or General Item PR. General Item requires an approved packaged project catalogue entry; standard mode does not consume project selection as a domain input.
5. Resolve contract/subcontractor/region/reference values and render ECC with packaged assets.
6. Publish only approved generated artifacts and skill-created delivery archive. Output multiplicity depends on the run, not a fixed five-file promise.

UI dropdown metadata is presentation-only; Python checks the actual catalogue. Tests check catalogue/dropdown parity. Rule quantities, field names and configuration ownership must not be reimplemented in Node or inferred from similar MW templates.

Sources: `src/main.py`, normalization/calculation/PR/export modules and packaged configuration. See [contract](SKILL_CONTRACT.md) for the narrower public inputs and [pending](PENDING.md) for unresolved error-safety review.
