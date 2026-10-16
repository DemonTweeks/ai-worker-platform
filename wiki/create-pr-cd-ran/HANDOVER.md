# Create PR CD RAN - Handover

Current platform pin `15fae20943293091728d2308e78a8685735233de`, v1.1.2. Configured origin is BL2ZteSolution/create-pr-cd-ran, contract branch `refactor/standard-skill-contract`. Prior comparison found this pin four commits ahead of RAN main `239910e`: standard contract, manifest workbench, restored project dropdown, ZIP output. That comparison is historical; no remote refresh during this wiki review. Moving to main blindly could discard functionality.

Platform calls standalone Python, not legacy FastAPI. Workspace copies preserve packaged config; changing business assets requires release/approval. `tests/test_skill_contract.py` covers identity/hashes, result checksums, project-catalogue dropdown parity and ZIP membership. A historical sample produced five outputs; current contract allows variable counts and delivery archive. No fresh RAN execution occurred for this audit.

Source ownership and contracts: [Architecture](ARCHITECTURE.md), [Business logic](BUSINESS_LOGIC.md), [Skill contract](SKILL_CONTRACT.md). Existing origin/upstream permission notes in [platform handover](../HANDOVER.md) are historical observations, not a new permission check. Keep source/asset changes in the skill and pin a reviewed commit; do not make UI catalogue changes without matching Python validation.
