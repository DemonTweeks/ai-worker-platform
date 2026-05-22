---
name: firebase-db
description: A minimal Firebase Realtime Database I/O layer. This skill ONLY performs raw read and write operations. It does NOT contain any business logic or schema assumptions.
---

# Firebase DB

A thin wrapper around Firebase Realtime Database REST API. Use this skill when you need to read or write arbitrary JSON data to a known path without any domain-specific processing.

## Base URL
`https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform`

## When to Use
- Direct read/write to Firebase with full control over path and payload
- Simple data access without validation or transformation
- Debugging or ad-hoc queries

## Command Structure

### Write Operation (PATCH)

Trigger:
```
write-firebase {path} "{json_payload}"
```

Rules:
- `{path}` is a full relative Firebase path (no leading slash)
- `{path}` any space in between will replace to hyphens
- `{json_payload}` must be valid JSON
- Always use PATCH (no PUT)

Example:
```
write-firebase user/+601156618786/profile {"createdAt":1777275629,"lastActiveAt":1777275629}
```

Backend:
```bash
curl -X PATCH \
 -H "Content-Type: application/json" \
 -d '{json_payload}' \
 "https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/{path}.json"
```

### Log Writer (POST)

Rules:
- Optional: Manually log any write operation for audit trail
- The `path` field in the log payload must store the **actual Firebase key** (no `.json` suffix)
- This keeps logs clean and matches how data is stored (not the REST endpoint)

Example (paired with a write):
```
# Write data to test/data_123
write-firebase test/data_123 {"value":123,"status":"ok"}

# Corresponding log entry (note: path WITHOUT .json)
write-firebase-log /log {"createdAt":1777275629,"path":"/test/data_123","content":{"value":123,"status":"ok"},"actor":"zte-claw-agent"}
```

Backend:
```bash
curl -X POST \
 -H "Content-Type: application/json" \
 -d '{json_payload}' \
 "https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/log/.json"
```


### Read Operation (GET)

Trigger:
```
read-firebase {path}
```

Rules:
- `{path}` is a full relative Firebase path
- `{path}` any space in between will replace to hyphens

Example:
```
read-firebase user/+601156618786/sites/Test1
```

Backend:
```bash
curl -X GET \
 "https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/{path}.json"
```

### Restrictions (safe mode)

- No PUT
- No DELETE

## AI Worker Platform Database Schema

When using this skill on the AI Worker Platform, the following path structure and REST operations apply:

### 1. Jobs (`/jobs/{jobId}`)
- **Read**: `read-firebase jobs/{jobId}`
- **Write**: `write-firebase jobs/{jobId} {job_payload}`
- **Description**: Stores full job state keyed by unique `jobId`.

### 2. Job Files (`/job_files/{jobId}/{fileId}`)
- **Read**: `read-firebase job_files/{jobId}`
- **Write**: `write-firebase job_files/{jobId}/{fileId} {file_payload}`
- **Description**: Stores job outputs and uploaded templates grouped hierarchically under `jobId` for O(1) job detail loads.

### 3. Review Required Items (`/review_required_items/{jobId}/{itemId}`)
- **Read**: `read-firebase review_required_items/{jobId}`
- **Write**: `write-firebase review_required_items/{jobId}/{itemId} {item_payload}`
- **Description**: Stores site-level issues requiring operator verification.

### 4. Warning Items (`/warning_items/{jobId}/{itemId}`)
- **Read**: `read-firebase warning_items/{jobId}`
- **Write**: `write-firebase warning_items/{jobId}/{itemId} {warning_payload}`
- **Description**: Stores warnings and non-blocking issues generated during execution.

### 5. Assets (`/assets/{version}`)
- **Read**: `read-firebase assets`
- **Write**: `write-firebase assets/{version} {asset_payload}`
- **Description**: Stores active model templates (e.g. `pr_model`, `ecc_template`) keyed by version.

### 6. Admin Users (`/admin_users/{username}`)
- **Read**: `read-firebase admin_users/{username}`
- **Write**: `write-firebase admin_users/{username} {user_payload}`
- **Description**: Stores admin dashboard credentials. Username is lowercased.

### 7. Admin Audit Logs (`/admin_audit_logs`)
- **Write (Audit Trail)**: `write-firebase-log /admin_audit_logs {log_payload}`
- **Description**: Appends records to the global audit trail via HTTP POST.



