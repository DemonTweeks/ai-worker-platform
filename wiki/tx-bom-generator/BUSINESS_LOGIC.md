# Domain ownership and safety

Engine exact normalisation/deduplication owns site selection. No fuzzy match or all-sites mode. SOW/frequency/antenna configuration selects NE/FE independently; same-column selections are counted per end. Duplicate selected material mappings and missing configurations fail affected sites only. BOX warnings are orthogonal to material eligibility.

Migration safety changes are documented in skill docs/SAFETY.md: literal leading-equals metadata, rejection of selected quantity formulas even with caches, typed EPMS field validation, broken retained-template reference detection without repair. No entitlement, mapping or engineering quantity fixes are inferred.

Only verified generated sites are included in the workbook. Clean completion requires no warnings. Mixed batches or BOX/config warnings are completed_with_warning. All-failed or final integrity/verification/reconciliation failure is failed. No published BOM after a finalisation gate fails.
