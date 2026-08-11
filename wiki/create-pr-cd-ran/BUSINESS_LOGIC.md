# Create PR CD RAN - Business Logic

The skill owns normalization, EPMS lookup, subcontractor/region/contract mapping, calculation rules, PR line generation, optional General Item project selection, and ECC workbook rendering. The platform does not reproduce or interpret these rules.

`general-item` mode requires a project present in `GENERAL ITEM FOR ALL DU PROJECT Overall.xlsx`; `standard-pr` ignores `selectedProject`.
