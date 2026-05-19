# Technical Design Document: AI Worker Platform — PR Worker MVP

## 1. Document Purpose

This document defines the full technical design for the **AI Worker Platform**, with **PR Worker / create-pr-cd** as the first MVP worker.

The platform is designed to convert the current developer-operated repo/skill workflow into a centralized internal WebApp that normal business users can use through a browser, without VS Code, Codex, Git, terminal, or local runtime setup.

The design follows the confirmed direction:

```text
Phase 1: Internal PR Worker WebApp
Future: Multi-skill AI Worker Platform
```

Core principle:

```text
Rule Engine / create-pr-cd = business correctness
LLM = persona, explanation, and user interaction
WebApp = business user interface
OpenClaw = future optional trigger channel
```

---

## 2. Product Positioning

### 2.1 Current Product Strategy

The first version is an **internal tool** for company users.

Primary users:

```text
Planner
PM
Operation user
TX team user
```

The tool allows users to upload an iEPMS export file, select target site scope, generate PR/ECC outputs, review summary, and download result files.

### 2.2 Future Platform Direction

Although Phase 1 only delivers PR Worker, the architecture must support future multi-skill expansion.

Future workers may include:

```text
PR Worker
BOQ Worker
EHS Reviewer
L1 Checker
PAC Worker
MW Planning Checker
Site Navigator Worker
```

The architecture therefore follows:

```text
Single Skill Today
Multi-Skill Ready Tomorrow
```

---

## 3. Problem Statement

### 3.1 Current Workflow

Current technical workflow:

```text
JJ / Developer
  ↓
VS Code
  ↓
Codex / OpenClaw / CLI
  ↓
create-pr-cd repo
  ↓
Excel Output
```

This works for development, testing, debugging, and rule iteration.

### 3.2 Business Limitation

Normal business users do not have or should not need:

```text
VS Code
Git / GitHub access
Codex
OpenClaw runtime
Node / Python environment setup
Command-line knowledge
Repo structure knowledge
Manual dependency installation
```

### 3.3 Target Solution

Target user experience:

```text
User opens WebApp
  ↓
Uploads iEPMS export
  ↓
Inputs site codes or selects Generate All Sites
  ↓
Clicks Generate
  ↓
PR Worker works asynchronously
  ↓
Conversation panel shows human-like progress
  ↓
User downloads ECC / reports
```

---

## 4. Business Objectives

```text
1. Remove developer environment dependency for normal users.
2. Provide browser-based PR/ECC generation.
3. Keep create-pr-cd business logic controlled and deterministic.
4. Provide AI Worker style communication instead of cold machine output.
5. Support batch generation by site / subcon / region / scope.
6. Provide Summary Dashboard, REVIEW_REQUIRED list, and Error / Warning Report.
7. Support admin-managed PR Model, Contract Info, and ECC Template.
8. Keep job history and audit metadata.
9. Prepare architecture for future OpenClaw trigger.
10. Prepare architecture for future multi-skill AI Worker Platform.
```

---

## 5. Confirmed Key Decisions

### 5.1 Product and Platform Decisions

```text
Product Strategy: Internal Tool first, future multi-skill platform ready
Execution Model: Async Job Model
Persona: OpenClaw-aligned Worker Persona
Worker Model: Skill-based Worker Model
MVP Worker: PR Worker / create-pr-cd only
Output Philosophy: AI output is final output
Communication Style: Professional Corporate + Human Collaboration Feel
Language: English only
```

### 5.2 Runtime and Deployment Decisions

```text
Deployment: Windows 11 Pro internal machine
Access: Internal network first, e.g. http://10.x.x.x:3000
HTTPS: Phase 1 HTTP acceptable, future HTTPS
Database: Local MongoDB
Storage: Local Windows folder
Runtime: Single Express.js process
Queue: Multi-job FIFO queue
Max Concurrent Jobs: 2
```

### 5.3 Input and Output Decisions

```text
User Upload: iEPMS Export / Site PR/PO View only
System Assets: PR Model, Contract Info, ECC Template
Admin Asset Management: Admin Portal
Site Selection: Site Code textbox + Generate All Sites option
Batch Mode: One upload can generate multiple subcon / region / scope outputs
Output: ECC Excel, Summary Dashboard, REVIEW_REQUIRED, Error/Warning Excel
Download: Individual files + ZIP package
```

---

## 6. High-Level Architecture

```text
Business User
  ↓ Browser
Vue2 WebApp
  ↓ HTTP / WebSocket
Express.js Backend
  ↓
Job Manager / Queue / Worker
  ↓ child process
create-pr-cd Skill Execution
  ↓
ECC Output / Summary / REVIEW_REQUIRED / Warning Report
  ↓
WebApp Result UI + Conversation Panel
```

Future OpenClaw path:

```text
OpenClaw
  ↓ API
Express.js Backend
  ↓
Same PR Worker Execution
  ↓
Conversational response + result link
```

---

## 7. Logical Architecture Diagram

```text
┌────────────────────────────────────────────┐
│ Business User                              │
│ Planner / PM / Operation / TX Team         │
└──────────────────────┬─────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│ Vue2 WebApp                                │
│                                            │
│ - PR Worker page                           │
│ - Upload iEPMS Export                      │
│ - Site Code input                          │
│ - Generate All Sites option                │
│ - Generate button                          │
│ - Conversation panel                       │
│ - Job History                              │
│ - Job Detail                               │
│ - Admin Login                              │
└──────────────────────┬─────────────────────┘
                       │ HTTP / WebSocket
                       ▼
┌────────────────────────────────────────────┐
│ Express.js Backend — Single Process        │
│                                            │
│ - REST API                                 │
│ - WebSocket Server                         │
│ - Admin Auth                               │
│ - Job Manager                              │
│ - FIFO Queue                               │
│ - Worker Runner                            │
│ - Asset Manager                            │
│ - LLM Client                               │
│ - Health Dashboard API                     │
└───────────────┬───────────────┬────────────┘
                │               │
                ▼               ▼
┌────────────────────────┐   ┌─────────────────────────┐
│ MongoDB Local           │   │ Local File Storage      │
│                         │   │                         │
│ - Jobs                  │   │ - Uploaded exports      │
│ - Assets metadata       │   │ - ECC outputs           │
│ - Audit logs            │   │ - Warning reports       │
│ - Job summaries         │   │ - Asset files           │
│ - Review metadata       │   │ - Temporary files       │
└────────────────────────┘   └─────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│ Worker Runner                              │
│                                            │
│ - Pre-validation                           │
│ - Site filtering                           │
│ - Prepare working folder                   │
│ - Spawn create-pr-cd child process         │
│ - Capture stdout/stderr                    │
│ - Collect outputs                          │
│ - Emit progress through WebSocket          │
└──────────────────────┬─────────────────────┘
                       │ child process
                       ▼
┌────────────────────────────────────────────┐
│ skills/create-pr-cd                        │
│                                            │
│ Existing repo / skill logic                │
│ Executed as child process                  │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Internal LLM MaaS Gateway                  │
│ Qwen3-235B-A22B                            │
│                                            │
│ Used for persona, explanation and Q&A      │
└────────────────────────────────────────────┘
```

---

## 8. Technology Stack

### 8.1 Final Stack

```text
Frontend:
Vue2

Backend:
Express.js / Node.js

Database:
MongoDB local VM

Async Execution:
Single Express process with internal FIFO job queue

Realtime Update:
WebSocket

Excel Processing:
xlsx / SheetJS for parsing
ExcelJS for output generation and formatting

Skill Execution:
Child process execution of create-pr-cd

LLM:
Internal MaaS Gateway — Qwen3-235B-A22B

Storage:
Local Windows folder storage

Deployment:
Windows 11 Pro + Docker Desktop + Docker Compose

Reverse Proxy:
Nginx optional, not mandatory for Phase 1 HTTP
```

### 8.2 Why This Stack

This stack matches the user-confirmed environment and delivery style:

```text
Vue2: compatible with existing frontend preference
Express.js: lightweight Node backend for internal tool
MongoDB: flexible metadata storage and local deployment friendly
WebSocket: good for worker progress and conversational timeline
Child process: loose coupling with create-pr-cd repo logic
Local storage: simple and suitable for internal VM
Internal LLM: data stays inside internal network
```

---

## 9. Repository Structure

Confirmed strategy: **same repository**.

```text
ai-worker-platform/

├── frontend/
│   └── vue2-app/
│       ├── src/
│       ├── public/
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── websocket/
│   │   ├── jobs/
│   │   ├── queue/
│   │   ├── worker/
│   │   ├── assets/
│   │   ├── llm/
│   │   ├── health/
│   │   └── utils/
│   └── package.json
│
├── skills/
│   └── create-pr-cd/
│       ├── index.js
│       ├── package.json
│       ├── engine/
│       ├── rules/
│       └── templates/
│
├── storage/
│   ├── jobs/
│   ├── assets/
│   ├── outputs/
│   └── temp/
│
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile
│
└── docs/
    ├── technical-design.md
    ├── architecture-decision-record.md
    └── mvp-task-list.md
```

---

## 10. User Experience Design

### 10.1 Main UI Style

Confirmed UI style: **Hybrid Worker UI**.

The page combines:

```text
AI Worker Persona
+
Structured Enterprise Form
+
Embedded Bottom Conversation Panel
```

### 10.2 PR Worker Main Page

```text
┌──────────────────────────────────────────────────────┐
│ PR Worker                                            │
├──────────────────────────────────────────────────────┤
│ PR Worker:                                           │
│                                                      │
│ I can help you generate PR ECC from iEPMS export.    │
│                                                      │
│ Please upload your file and select generation scope. │
│                                                      │
│                                      [ Admin Login ] │
├──────────────────────────────────────────────────────┤
│ Upload iEPMS Export                                  │
│ [ Choose File ]                                      │
│                                                      │
│ Generation Scope                                     │
│ (•) Generate by Site Code                            │
│ ( ) Generate All Sites                               │
│                                                      │
│ Site Codes                                           │
│ ┌───────────────────────────────────────────────┐    │
│ │ B00577                                       │    │
│ │ K00340                                      │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│                  [ GENERATE ]                        │
├──────────────────────────────────────────────────────┤
│ Conversation Timeline                                │
│                                                      │
│ PR Worker: Task received.                            │
│ PR Worker: Validating uploaded export...             │
│ PR Worker: PR model loaded successfully.             │
│ PR Worker: Starting ECC generation...                │
└──────────────────────────────────────────────────────┘
```

### 10.3 Conversation Panel

Conversation panel behavior:

```text
Displayed during current task
Not saved as full conversation
Uses worker-style English messages
Updated through WebSocket heartbeat and events
```

Full conversation is not persisted.

Only final worker summary is saved in Job History.

---

## 11. Input Model

### 11.1 User Input

User provides only:

```text
1. iEPMS Export Excel / Site PR/PO View
2. Site Code list OR Generate All Sites option
```

### 11.2 System Managed Assets

System provides:

```text
1. PR Model
2. Contract Info
3. ECC Template
```

These assets are managed through Admin Portal.

### 11.3 Site Selection Rule

User has two options:

```text
Option 1: Generate by Site Code
Option 2: Generate All Sites
```

Validation rule:

```text
No site code + no Generate All = block generation and ask user to select scope
```

Site code input supports:

```text
Newline separated
Comma separated
Space separated
```

Normalization:

```text
Trim spaces
Convert to uppercase
Remove hidden characters
Deduplicate
Case-insensitive matching
```

Duplicate site code behavior:

```text
Auto deduplicate
Continue execution
Record warning in Error / Warning Report
```

Unmatched site code behavior:

```text
Continue generation for matched sites
Record unmatched site codes in Error / Warning Report
```

---

## 12. Pre-Validation Design

Pre-validation is required before Generate button becomes enabled.

### 12.1 Pre-validation Checks

```text
File extension valid
Excel readable
File size within limit
Row count within limit
Required sheet exists
Required columns exist
```

Required sheet / column definitions are code-defined.

If iEPMS export format changes, developer updates parser/validation code and redeploys.

### 12.2 Pre-validation UI

Result display:

```text
Checklist + AI Worker explanation
```

Example pass:

```text
✓ File type valid
✓ Excel readable
✓ Required sheet found
✓ Required columns found
✓ Row count within limit
✓ File size within limit
```

Worker message:

```text
The uploaded iEPMS export passed the initial validation.
I found the required sheet and mandatory columns.
You can now proceed with PR/ECC generation.
```

Example fail:

```text
✓ File type valid
✓ Excel readable
✗ Required column missing: Site Code
✓ Row count within limit
```

Worker message:

```text
I cannot start the task yet.
The uploaded file is missing the required Site Code column.
Please upload a valid iEPMS export before generating PR/ECC.
```

Generate button behavior:

```text
Pre-validation passed = enabled
Pre-validation failed = disabled
```

---

## 13. Job Execution Design

### 13.1 Async Job Model

Each Generate action creates a new job.

```text
Upload + scope selection
  ↓
Create Job
  ↓
Queue Job
  ↓
Worker executes asynchronously
  ↓
WebSocket progress update
  ↓
Output generated
```

Every run is a new job.

The system does not automatically continue previous jobs.

### 13.2 Job Queue

Queue strategy:

```text
FIFO
Max concurrent running jobs = 2
Extra jobs = queued
```

Example:

```text
Running:
Job 001
Job 002

Queued:
Job 003
Job 004
```

### 13.3 Job Status Model

Detailed status model:

```text
Queued
Validating
Filtering Sites
Loading Assets
Generating
Exporting
Waiting for User Input
Completed
Completed with Warning
Failed
Cancelled
Cancelled with Partial Result
```

### 13.4 Worker Execution Flow

```text
1. Create job record
2. Store uploaded iEPMS export
3. Run pre-validation
4. Enable Generate if valid
5. Queue job
6. Filter sites based on user scope
7. Load active PR Model / Contract Info / ECC Template
8. Prepare job working folder
9. Spawn create-pr-cd child process
10. Capture stdout / stderr
11. Parse outputs
12. Generate Summary Dashboard data
13. Generate REVIEW_REQUIRED list
14. Generate Error / Warning Report
15. Generate ZIP package
16. Save final worker summary
17. Mark job completed / warning / failed
```

---

## 14. Child Process Execution Design

Confirmed integration model: **child process execution**.

### 14.1 Purpose

The Express backend should not directly embed create-pr-cd logic.

Instead:

```text
Express Worker
  ↓
spawn child process
  ↓
skills/create-pr-cd/index.js
```

Benefits:

```text
Loose coupling
Better crash isolation
Skill can evolve independently
Easier Codex iteration
Backend remains orchestration layer
```

### 14.2 Example Execution

```javascript
spawn('node', [
  'skills/create-pr-cd/index.js',
  '--input', filteredInputPath,
  '--pr-model', activePrModelPath,
  '--contract-info', activeContractInfoPath,
  '--ecc-template', activeEccTemplatePath,
  '--output-dir', jobOutputDir,
  '--date', outputDate
])
```

### 14.3 Process Monitoring

Backend must capture:

```text
stdout
stderr
exit code
start time
end time
timeout
output files
```

Critical failure if:

```text
Child process exits non-zero
Timeout exceeded
No output generated when expected
Core engine exception detected
```

---

## 15. WebSocket Design

### 15.1 Update Model

Confirmed update model:

```text
Timed heartbeat every 5 seconds
Major events pushed immediately
```

Example heartbeat:

```text
PR Worker:
Still processing...
Current phase: PR generation
Processed rows: 145 / 420
Elapsed time: 02m 14s
```

### 15.2 Reconnect Behavior

Confirmed behavior:

```text
Auto reconnect + resume live status
```

If browser refreshes or network disconnects:

```text
Reconnect WebSocket
Reload active job state
Resume live progress
```

### 15.3 Multi-tab Behavior

Confirmed:

```text
Independent per tab
```

Each tab subscribes to a job channel:

```json
{
  "action": "subscribe",
  "jobId": "PR-20260520-001"
}
```

Backend only sends events for subscribed job.

---

## 16. LLM Design

### 16.1 LLM Provider

Confirmed provider:

```text
Internal MaaS Gateway
Qwen3-235B-A22B
```

### 16.2 LLM Responsibilities

LLM is responsible for:

```text
Worker persona
Human-like progress messages
Result explanation
Interactive Q&A
Final worker summary
REVIEW_REQUIRED explanation
Error / warning explanation
```

LLM is not responsible for:

```text
Directly generating ECC
Directly deciding PR line item
Guessing contract number
Replacing create-pr-cd business logic
Changing generated result without deterministic validation
```

### 16.3 Data Access Scope

LLM may access full job data through a controlled **Job Data Access Layer**.

Accessible data:

```text
Summary
REVIEW_REQUIRED list
Error / Warning Report data
Parsed iEPMS data
Generated ECC metadata
Job events
Asset versions used
```

Design rule:

```text
LLM does not directly read raw Excel files.
Backend retrieves relevant data, structures context, and sends only relevant context to LLM.
```

### 16.4 Language and Style

Language:

```text
English only
```

Style:

```text
Professional Corporate + Human Collaboration Feel
Moderately Proactive
```

Completion message standard:

```text
Task completed.

Processed: 245 rows
Generated: 218 rows
Review Required: 27 rows

You can download the ECC files now. I recommend reviewing the REVIEW_REQUIRED report before submission.
```

---

## 17. Output Design

### 17.1 Output Types

MVP output includes:

```text
ECC Excel files
Summary Dashboard
REVIEW_REQUIRED list
Error / Warning Report Excel
ZIP package containing all outputs
```

### 17.2 Batch Output

Batch Mode supports:

```text
Single ECC file download
ZIP download for all files
```

ZIP structure:

```text
PR_Worker_Job_XXXX.zip
 ├── ECC_Output/
 ├── Review_Required_Report.xlsx
 ├── Error_Warning_Report.xlsx
 └── Summary_Report.html or json
```

### 17.3 Naming Convention

ECC file naming standard:

```text
{Region}-{Subcon} TX Mini Project {Scope} PR {YYYYMMDD}.xlsx
```

Examples:

```text
Northern-Allstar TX Mini Project TSS PR 20260519.xlsx
Southern-GCI TX Mini Project TI PR 20260519.xlsx
Central-GTSB TX Mini Project Planning PR 20260519.xlsx
```

---

## 18. REVIEW_REQUIRED and Warning Rules

The platform must follow the repo-defined create-pr-cd business rules.

### 18.1 REVIEW_REQUIRED

Confirmed platform behavior:

```text
REVIEW_REQUIRED rows do not generate ECC line output
They are listed in REVIEW_REQUIRED report
They are included in Error / Warning Report
```

### 18.2 Duplicate Handling

Confirmed behavior:

```text
Duplicate does not block generation
Generate anyway
Record duplicate warning in Error / Warning Report
```

### 18.3 Unmatched Site Code

Confirmed behavior:

```text
Continue generation for matched sites
Unmatched site code goes to Error / Warning Report
```

---

## 19. Job History Design

### 19.1 Access Model

Normal users do not login.

All users can see Job History.

Admin login is only required for Admin Portal.

### 19.2 Retention

```text
Job History: keep forever
Job Metadata: keep forever
Summary: keep forever
Final Worker Summary: keep forever
REVIEW_REQUIRED metadata: keep forever
Asset version record: keep forever
```

File retention:

```text
Uploaded iEPMS Export: 180 days
ECC Output Files: 180 days
Error / Warning Reports: 180 days
Temporary files: 180 days or cleanup policy
```

### 19.3 Conversation Persistence

Full conversation is not saved.

Only final worker summary is saved.

### 19.4 Job History UI

Confirmed UI: **Hybrid**.

Top:

```text
Filter
Search
Summary statistics
```

Bottom:

```text
Job cards
```

Example job card:

```text
PR Worker
Status: Completed with Review Required
Job ID: PR-20260519-001
Created: 2026-05-19 15:42
Sites: 18 matched / 2 unmatched
ECC Files: 4
Review Required: 6
Final Worker Summary: ...
[ OPEN ] [ DOWNLOAD ] [ REPORT ]
```

### 19.5 Job Detail Page

Job Detail includes:

```text
Job Summary
Final Worker Summary
ECC Output List
REVIEW_REQUIRED Table
Error / Warning Report
Asset Versions Used
Re-Ask PR Worker Panel
```

Re-Ask behavior:

```text
User can ask questions based on job data
Q&A is temporary and not saved
```

### 19.6 Expired Files

Phase 1:

```text
If output file expired, show File Expired.
```

Phase 2:

```text
Support Regenerate if original input and asset versions are available.
```

---

## 20. Admin Portal Design

### 20.1 Admin Access

Admin can access via:

```text
Homepage Admin Login button
Direct /admin URL
```

Authentication:

```text
Simple username + password
Local DB
Password hashed
```

Admin accounts:

```text
Phase 1: one preset admin account
Phase 2: admin account management
```

### 20.2 Admin Asset Management

Admin manages:

```text
PR Model
Contract Info
ECC Template
```

Admin can:

```text
Upload new asset version
Activate uploaded version
View version history
```

Admin uploaded asset becomes active immediately after activation.

No approval flow is required.

### 20.3 Asset Validation

Phase 1 validation:

```text
Basic technical validation only
- file exists
- file type valid
- file readable
- file not corrupted
```

Admin is responsible for business correctness of uploaded assets.

### 20.4 Asset Versioning

Version naming:

```text
System auto-generated
```

Examples:

```text
PR_MODEL_20260519_153045
CONTRACT_INFO_20260519_153102
ECC_TEMPLATE_20260519_153515
```

Old asset versions:

```text
Keep forever
```

Each job records:

```text
PR Model version
Contract Info version
ECC Template version
Engine version
Execution time
```

Rollback:

```text
No one-click rollback in Phase 1
Admin re-uploads old file if needed
```

### 20.5 Admin Audit Log

Audit log required for:

```text
Admin login
Admin logout
Asset upload
Asset activate
Password change
Configuration change
```

Audit record example:

```text
Timestamp
Admin username
Action
Asset type
Version
Status
IP address
```

---

## 21. Health Dashboard

Admin Portal includes a simple Health Dashboard.

Status items:

```text
Backend API: Healthy
MongoDB: Connected
Storage: OK
LLM Gateway: Connected
Queue: Running
Active Jobs: 2
Queued Jobs: 5
Disk Usage: 62%
```

Purpose:

```text
Quickly verify system availability
Troubleshoot LLM / DB / storage / worker issues
Support internal operation
```

---

## 22. Failure Handling Design

Confirmed failure model: **Hybrid Failure Strategy**.

### 22.1 Recoverable Error

Continue where possible.

Examples:

```text
LLM timeout
Conversation response failure
Optional report generation issue
Minor parsing warning
```

Behavior:

```text
Continue core generation
Record warning
Show in Error / Warning Report
```

### 22.2 Critical Error

Stop job.

Examples:

```text
Unreadable input file
Core engine exception
Storage unavailable
MongoDB unavailable
Child process fatal error
```

Behavior:

```text
Mark job Failed
Show worker explanation
Store error metadata
```

### 22.3 Partial Business Result

If partial result is possible:

```text
Generate successful outputs
Record failed items
Do not fail entire job unnecessarily
```

---

## 23. Cancel Job Design

User can cancel running job.

Cancelable statuses:

```text
Queued
Validating
Filtering Sites
Loading Assets
Generating
Exporting
Waiting for User Input
```

Non-cancelable statuses:

```text
Completed
Completed with Warning
Failed
Cancelled
Cancelled with Partial Result
```

Cancel behavior:

```text
Graceful cancel
Finish current safe checkpoint
Stop execution
Cleanup temporary resources
Mark job cancelled
```

Partial output policy:

```text
Keep partial output
```

If partial result exists:

```text
Status = Cancelled with Partial Result
User can download completed outputs
```

---

## 24. Resource Protection

Hard limits are required.

Recommended initial limits:

```text
Max Upload File Size: 100 MB
Max Excel Row Count: 50,000 rows
Max Requested Site Codes: 5,000
Max Job Execution Timeout: 60 minutes
Max Generated Output Files: 200
```

If exceeded:

```text
Reject job
Show clear PR Worker explanation
Mark as Resource Limit Exceeded
```

Example message:

```text
The uploaded dataset exceeds the supported processing limit.
Detected: 78,421 rows
Current limit: 50,000 rows
Please reduce the dataset size or split the job into smaller batches.
```

---

## 25. Database Design — MongoDB Collections

### 25.1 jobs

```json
{
  "jobId": "PR-20260519-001",
  "workerType": "pr-worker",
  "status": "completed_with_warning",
  "createdAt": "2026-05-19T15:42:00+08:00",
  "startedAt": "2026-05-19T15:43:00+08:00",
  "completedAt": "2026-05-19T15:48:00+08:00",
  "generationScope": "site_code",
  "requestedSiteCount": 20,
  "matchedSiteCount": 18,
  "unmatchedSiteCount": 2,
  "finalWorkerSummary": "Task completed...",
  "assetVersions": {
    "prModel": "PR_MODEL_20260519_153045",
    "contractInfo": "CONTRACT_INFO_20260519_153102",
    "eccTemplate": "ECC_TEMPLATE_20260519_153515"
  },
  "engineVersion": "create-pr-cd-v1",
  "fileRetentionUntil": "2026-11-15T00:00:00+08:00"
}
```

### 25.2 job_files

```json
{
  "jobId": "PR-20260519-001",
  "fileType": "uploaded_export",
  "fileName": "iEPMS_export.xlsx",
  "filePath": "storage/jobs/PR-20260519-001/input/iEPMS_export.xlsx",
  "retentionUntil": "2026-11-15T00:00:00+08:00",
  "createdAt": "2026-05-19T15:42:00+08:00"
}
```

### 25.3 assets

```json
{
  "assetType": "pr_model",
  "version": "PR_MODEL_20260519_153045",
  "fileName": "pr_model.xlsx",
  "filePath": "storage/assets/pr_model/PR_MODEL_20260519_153045.xlsx",
  "isActive": true,
  "uploadedBy": "admin",
  "uploadedAt": "2026-05-19T15:30:45+08:00"
}
```

### 25.4 review_required_items

```json
{
  "jobId": "PR-20260519-001",
  "siteCode": "B00577",
  "sourceRow": 12,
  "scope": "TSS",
  "subcon": "Allstar",
  "issueType": "MISSING_MANDATORY_MAPPING",
  "description": "Required mapping could not be determined safely.",
  "severity": "high"
}
```

### 25.5 warnings

```json
{
  "jobId": "PR-20260519-001",
  "warningType": "DUPLICATE_SITE_CODE_INPUT",
  "siteCode": "B00577",
  "description": "Duplicate site code was provided and processed once only."
}
```

### 25.6 admin_audit_logs

```json
{
  "timestamp": "2026-05-19T15:35:22+08:00",
  "admin": "admin",
  "action": "UPLOAD_ASSET",
  "assetType": "pr_model",
  "version": "PR_MODEL_20260519_153045",
  "status": "success",
  "ip": "10.x.x.x"
}
```

---

## 26. API Design

### 26.1 Public User APIs

```http
POST /api/jobs/prevalidate
POST /api/jobs
GET  /api/jobs
GET  /api/jobs/:jobId
POST /api/jobs/:jobId/cancel
GET  /api/jobs/:jobId/download/:fileId
GET  /api/jobs/:jobId/download-zip
POST /api/jobs/:jobId/ask
```

### 26.2 Admin APIs

```http
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/assets
POST /api/admin/assets/upload
POST /api/admin/assets/:version/activate
GET  /api/admin/audit-logs
GET  /api/admin/health
```

### 26.3 WebSocket Events

Client subscribe:

```json
{
  "action": "subscribe",
  "jobId": "PR-20260520-001"
}
```

Server event example:

```json
{
  "jobId": "PR-20260520-001",
  "eventType": "HEARTBEAT",
  "status": "Generating",
  "message": "Still processing... Current phase: PR generation.",
  "progress": {
    "processedRows": 145,
    "totalRows": 420,
    "elapsedSeconds": 134
  }
}
```

---

## 27. OpenClaw Future Integration

OpenClaw will call the same backend APIs.

OpenClaw should not duplicate business logic.

Future flow:

```text
User tells OpenClaw to generate PR ECC
  ↓
OpenClaw uploads iEPMS export to backend API
  ↓
OpenClaw creates PR Worker job
  ↓
Backend runs same job pipeline
  ↓
OpenClaw receives conversational status / result
  ↓
OpenClaw reports back to user
```

Important:

```text
WebApp and OpenClaw must use the same Conversational Response Layer.
```

So OpenClaw should not return cold JSON only.

It should receive:

```json
{
  "machineResult": {...},
  "assistantMessage": "Task completed. I processed 18 matched sites..."
}
```

---

## 28. Security Design

### 28.1 Normal Users

```text
No login required
Can upload file
Can generate job
Can view Job History
Can download available output
```

This is acceptable for Phase 1 internal network deployment.

### 28.2 Admin

```text
Admin login required
Simple username/password
Password hashed
Session timeout recommended
Admin audit log required
```

### 28.3 File Security

Controls:

```text
Restrict allowed file types
Limit upload size
Use generated storage filenames
Prevent path traversal
Do not expose direct local file path
Clean expired files
```

### 28.4 Network Security

Phase 1:

```text
Internal network only
HTTP accepted
```

Future:

```text
HTTPS
Domain name
Access control
VPN / Zero Trust if public access is required
```

---

## 29. Deployment Design

### 29.1 Phase 1 Deployment

```text
Windows 11 Pro
Docker Desktop
Docker Compose
Internal IP access
Local MongoDB
Local file storage
```

### 29.2 Docker Services

Although runtime is logically single Express process, deployment may include separate containers:

```text
frontend
backend
mongodb
```

Example:

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./storage:/app/storage
      - ./skills:/app/skills

  mongodb:
    image: mongo:7
    volumes:
      - ./mongo-data:/data/db
```

### 29.3 Access URL

Phase 1:

```text
http://10.x.x.x:3000
```

Future:

```text
https://pr-worker.company.local
```

---

## 30. Development Roadmap

### Phase 1 — PR Worker MVP

Scope:

```text
Vue2 WebApp
Express backend
MongoDB
Local file storage
Admin Portal
PR Worker execution
WebSocket progress
Summary / Reports / Download
```

### Phase 2 — Operational Enhancement

Scope:

```text
Same-job rerun
Online REVIEW_REQUIRED correction
Regenerate expired output
Admin account management
HTTPS
Better health monitoring
```

### Phase 3 — OpenClaw Integration

Scope:

```text
OpenClaw API client
Conversational response adapter
Agent-triggered PR Worker job
Agent result reporting
```

### Phase 4 — Multi-Skill Platform

Scope:

```text
Skill registry
New worker onboarding
BOQ Worker
EHS Reviewer
L1 Checker
PAC Worker
```

---

## 31. Final System Principle

The system should not be designed as a simple PR tool only.

It should be designed as:

```text
AI Worker Platform
  └── PR Worker as MVP
```

The key architecture principle:

```text
Worker executes deterministic skill logic.
LLM communicates like a professional digital colleague.
WebApp provides structured enterprise control.
OpenClaw can trigger the same worker later.
```

---

## 32. MVP Definition

MVP is considered complete when the system can:

```text
1. Let user open WebApp without login.
2. Upload iEPMS Export Excel.
3. Pre-validate file with checklist and worker explanation.
4. Let user input site codes or select Generate All Sites.
5. Create async PR Worker job.
6. Show WebSocket progress in conversation panel.
7. Execute create-pr-cd through child process.
8. Generate ECC Excel files.
9. Generate Summary Dashboard.
10. Generate REVIEW_REQUIRED list.
11. Generate Error / Warning Report Excel.
12. Allow individual file download and ZIP download.
13. Save Job History permanently.
14. Save final worker summary.
15. Allow Admin login.
16. Allow Admin to upload and activate PR Model / Contract Info / ECC Template.
17. Record asset versions used by each job.
18. Show Health Dashboard.
19. Support cancelling running job.
20. Support max 2 concurrent jobs with FIFO queue.
```

