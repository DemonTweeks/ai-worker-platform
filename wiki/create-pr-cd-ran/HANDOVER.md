# Create PR CD RAN - Handover

- Contract version: `1.0`.
- Skill version: `1.1.0`.
- Entrypoint: `src/main.py --input-manifest <path>`.
- Public files: one `bom` and one `epms` `.xlsx`.
- Parameters: `runMode` and optional `selectedProject`.
- Cancellation: `temp/cancel.requested` plus supervised child termination.
- Real generic sample execution completed with five tracked outputs.
