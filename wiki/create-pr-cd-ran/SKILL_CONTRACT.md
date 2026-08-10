# Create PR CD RAN - Skill Contract

The skill accepts the platform schema `1.0` input envelope and writes schema `1.0` `result.json`. Input and output paths must remain inside the workspace. Declared file size and SHA-256 are verified. Progress is emitted as NDJSON, and outputs include actual SHA-256 values.

Business validation errors are returned as safe skill-owned error codes; technical logs remain private.
