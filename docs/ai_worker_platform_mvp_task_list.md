# MVP Development Task List: AI Worker Platform — PR Worker MVP

## 1. Development Strategy

Confirmed strategy:

```text
B — Layered Architecture Strategy
```

Development will proceed by technical layer:

```text
1. Foundation / Repository / Environment
2. Database Layer
3. Backend API Layer
4. File Storage Layer
5. Admin Portal Layer
6. PR Worker Execution Layer
7. WebSocket / Realtime Layer
8. Frontend User Portal Layer
9. Job History / Job Detail Layer
10. LLM Layer
11. Health Dashboard Layer
12. Packaging / Deployment Layer
13. Testing / Hardening
```

Goal:

```text
Build a stable internal AI Worker Platform with PR Worker as MVP.
```

---

# EPIC 0 — Project Foundation

## Objective

Set up repository, development environment, coding structure, and baseline deployment layout.

## Tasks

### 0.1 Create Monorepo Structure

Deliverable:

```text
ai-worker-platform/
├── frontend/
├── backend/
├── skills/create-pr-cd/
├── storage/
├── docker/
└── docs/
```

Subtasks:

```text
- Create root repo structure
- Add frontend Vue2 folder
- Add backend Express folder
- Add skills/create-pr-cd folder
- Add storage placeholder folders
- Add docs folder
- Add .gitignore
- Add README.md
```

Acceptance Criteria:

```text
Repo can be cloned and opened cleanly.
Folder purpose is clear.
No runtime-generated storage files are committed.
```

---

### 0.2 Initialize Backend Project

Deliverable:

```text
backend/package.json
backend/src
```

Subtasks:

```text
- Initialize Node.js project
- Install Express
- Install dotenv
- Install mongoose
- Install ws or socket.io
- Install multer
- Install xlsx
- Install exceljs
- Install archiver
- Install bcrypt/jsonwebtoken or express-session
- Add nodemon for dev
- Add backend start script
```

Acceptance Criteria:

```text
Backend starts successfully.
Health route returns basic response.
```

---

### 0.3 Initialize Frontend Project

Deliverable:

```text
frontend Vue2 app
```

Subtasks:

```text
- Create Vue2 project
- Add router if needed
- Add axios
- Add basic layout
- Add API base URL config
- Add environment config
```

Acceptance Criteria:

```text
Vue2 app starts locally.
Can call backend health endpoint.
```

---

### 0.4 Environment Configuration

Deliverable:

```text
.env.example
```

Required variables:

```text
PORT
MONGO_URI
STORAGE_ROOT
LLM_BASE_URL
LLM_API_KEY
MAX_UPLOAD_SIZE_MB
MAX_ROW_COUNT
MAX_SITE_CODES
MAX_CONCURRENT_JOBS
JOB_TIMEOUT_MINUTES
FILE_RETENTION_DAYS
ADMIN_DEFAULT_USERNAME
ADMIN_DEFAULT_PASSWORD
```

Acceptance Criteria:

```text
System can run using .env.
No secrets are committed.
```

---

# EPIC 1 — Database Layer

## Objective

Implement MongoDB schema models for jobs, files, assets, warnings, review items, admin users, and audit logs.

---

## 1.1 MongoDB Connection Module

Deliverable:

```text
backend/src/db/mongo.js
```

Subtasks:

```text
- Configure mongoose connection
- Add connection retry
- Add connection logging
- Expose connection status for health dashboard
```

Acceptance Criteria:

```text
Backend connects to local MongoDB.
Connection failure is handled gracefully.
```

---

## 1.2 Job Model

Deliverable:

```text
backend/src/models/Job.js
```

Fields:

```text
jobId
workerType
status
createdAt
startedAt
completedAt
cancelledAt
generationScope
requestedSiteCount
matchedSiteCount
unmatchedSiteCount
outputFileCount
reviewRequiredCount
warningCount
finalWorkerSummary
assetVersions
engineVersion
fileRetentionUntil
error
```

Acceptance Criteria:

```text
Job document can be created, updated, queried, and listed.
```

---

## 1.3 Job File Model

Deliverable:

```text
backend/src/models/JobFile.js
```

Fields:

```text
jobId
fileType
fileName
filePath
fileSize
retentionUntil
createdAt
```

Acceptance Criteria:

```text
Uploaded input and generated output files can be tracked.
```

---

## 1.4 Asset Model

Deliverable:

```text
backend/src/models/Asset.js
```

Fields:

```text
assetType
version
fileName
filePath
fileSize
isActive
uploadedBy
uploadedAt
activatedAt
```

Asset types:

```text
pr_model
contract_info
ecc_template
```

Acceptance Criteria:

```text
System can store asset versions and identify active asset per type.
```

---

## 1.5 Review Required Model

Deliverable:

```text
backend/src/models/ReviewRequiredItem.js
```

Fields:

```text
jobId
siteCode
sourceRow
scope
subcon
issueType
description
severity
createdAt
```

Acceptance Criteria:

```text
REVIEW_REQUIRED items can be saved and retrieved by job.
```

---

## 1.6 Warning Model

Deliverable:

```text
backend/src/models/WarningItem.js
```

Fields:

```text
jobId
warningType
siteCode
description
sourceRow
createdAt
```

Acceptance Criteria:

```text
Duplicate site code, unmatched site code, and duplicate warnings can be stored.
```

---

## 1.7 Admin User Model

Deliverable:

```text
backend/src/models/AdminUser.js
```

Fields:

```text
username
passwordHash
createdAt
lastLoginAt
isActive
```

Acceptance Criteria:

```text
Default admin account can be created and authenticated.
```

---

## 1.8 Admin Audit Log Model

Deliverable:

```text
backend/src/models/AdminAuditLog.js
```

Fields:

```text
timestamp
admin
action
assetType
version
status
ip
metadata
```

Acceptance Criteria:

```text
Admin actions can be audited and queried.
```

---

# EPIC 2 — Local File Storage Layer

## Objective

Implement local storage structure for uploaded files, generated outputs, admin assets, temporary files, and ZIP packages.

---

## 2.1 Storage Folder Initialization

Deliverable:

```text
storage/
├── jobs/
├── assets/
├── outputs/
└── temp/
```

Subtasks:

```text
- Create startup storage initializer
- Validate storage root exists
- Create missing folders automatically
- Expose storage status to health dashboard
```

Acceptance Criteria:

```text
System can start with empty storage folder.
```

---

## 2.2 Job Working Folder Service

Deliverable:

```text
backend/src/services/storageService.js
```

Folder pattern:

```text
storage/jobs/{jobId}/
├── input/
├── filtered/
├── output/
├── reports/
└── temp/
```

Acceptance Criteria:

```text
Each job has isolated working folder.
```

---

## 2.3 Asset Storage Service

Folder pattern:

```text
storage/assets/pr_model/{version}.xlsx
storage/assets/contract_info/{version}.xlsx
storage/assets/ecc_template/{version}.xlsx
```

Acceptance Criteria:

```text
Admin uploaded assets are stored by type and version.
```

---

## 2.4 File Retention Metadata

Subtasks:

```text
- Apply 180-day retention to uploaded export and outputs
- Mark permanent metadata in MongoDB
- Prepare cleanup job placeholder
```

Acceptance Criteria:

```text
Each retained file has retentionUntil metadata.
```

---

# EPIC 3 — Backend Core API Layer

## Objective

Implement Express API endpoints for user job flow, job history, job detail, download, cancel, and Re-Ask PR Worker.

---

## 3.1 Express App Skeleton

Deliverable:

```text
backend/src/app.js
backend/src/server.js
```

Subtasks:

```text
- Setup Express app
- Add JSON parser
- Add CORS for internal frontend
- Add error handler
- Add request logging
- Add health route
```

Acceptance Criteria:

```text
Backend service starts and responds to /health.
```

---

## 3.2 Job ID Generator

Format:

```text
PR-YYYYMMDD-XXX
```

Example:

```text
PR-20260519-001
```

Acceptance Criteria:

```text
Job ID is unique and readable.
```

---

## 3.3 Upload and Pre-validation API

Endpoint:

```http
POST /api/jobs/prevalidate
```

Function:

```text
Upload iEPMS export
Store temp file
Run pre-validation
Return checklist
Return worker explanation
```

Acceptance Criteria:

```text
Valid file returns passed checklist.
Invalid file returns failed checklist.
Generate should not proceed with failed validation.
```

---

## 3.4 Create Job API

Endpoint:

```http
POST /api/jobs
```

Input:

```json
{
  "prevalidatedFileId": "...",
  "generationScope": "site_code | all_sites",
  "siteCodes": ["B00577", "K00340"]
}
```

Acceptance Criteria:

```text
Creates job record.
Moves uploaded file into job folder.
Queues job.
Returns jobId.
```

---

## 3.5 List Job History API

Endpoint:

```http
GET /api/jobs
```

Support filters:

```text
workerType
status
date range
search by jobId / file name
```

Acceptance Criteria:

```text
Job History page can load job cards.
```

---

## 3.6 Job Detail API

Endpoint:

```http
GET /api/jobs/:jobId
```

Return:

```text
Job summary
Final worker summary
Output list
REVIEW_REQUIRED list
Warning list
Asset versions used
File availability
```

Acceptance Criteria:

```text
Job Detail page can display full result.
```

---

## 3.7 Cancel Job API

Endpoint:

```http
POST /api/jobs/:jobId/cancel
```

Acceptance Criteria:

```text
Queued job can be cancelled.
Running job receives cancellation flag.
Partial output is preserved.
Status updates correctly.
```

---

## 3.8 Download APIs

Endpoints:

```http
GET /api/jobs/:jobId/download/:fileId
GET /api/jobs/:jobId/download-zip
```

Acceptance Criteria:

```text
User can download individual output and ZIP package if files are not expired.
Expired files return File Expired message.
```

---

## 3.9 Re-Ask PR Worker API

Endpoint:

```http
POST /api/jobs/:jobId/ask
```

Input:

```json
{
  "question": "Why this site was REVIEW_REQUIRED?"
}
```

Acceptance Criteria:

```text
LLM answers based on structured job data.
Q&A is not saved.
```

---

# EPIC 4 — Admin Portal Backend Layer

## Objective

Implement admin authentication, asset management, asset versioning, activation, and audit logging.

---

## 4.1 Admin Login API

Endpoint:

```http
POST /api/admin/login
```

Subtasks:

```text
- Validate username/password
- Hash password using bcrypt
- Create session or JWT
- Update lastLoginAt
- Write audit log
```

Acceptance Criteria:

```text
Admin can login with preset account.
Invalid login is rejected.
```

---

## 4.2 Admin Logout API

Endpoint:

```http
POST /api/admin/logout
```

Acceptance Criteria:

```text
Admin session is cleared.
Audit log is written.
```

---

## 4.3 Admin Middleware

Deliverable:

```text
backend/src/middleware/adminAuth.js
```

Acceptance Criteria:

```text
Admin APIs are protected.
Normal user cannot access admin endpoints.
```

---

## 4.4 Asset Upload API

Endpoint:

```http
POST /api/admin/assets/upload
```

Input:

```text
assetType = pr_model | contract_info | ecc_template
file = Excel file
```

Behavior:

```text
Basic technical validation
Generate version name
Store file
Create asset record
Write audit log
```

Acceptance Criteria:

```text
Admin can upload new asset version.
```

---

## 4.5 Asset Activate API

Endpoint:

```http
POST /api/admin/assets/:version/activate
```

Behavior:

```text
Set previous active asset of same type to inactive
Set selected version active
Write audit log
```

Acceptance Criteria:

```text
Only one active asset per asset type.
```

---

## 4.6 Asset List API

Endpoint:

```http
GET /api/admin/assets
```

Acceptance Criteria:

```text
Admin can view version history and active version per asset type.
```

---

## 4.7 Admin Audit Log API

Endpoint:

```http
GET /api/admin/audit-logs
```

Acceptance Criteria:

```text
Admin can view audit records.
```

---

# EPIC 5 — PR Worker Execution Layer

## Objective

Implement PR Worker orchestration, site filtering, asset loading, child process execution, output collection, and report generation.

---

## 5.1 Job Queue Manager

Deliverable:

```text
backend/src/queue/jobQueue.js
```

Rules:

```text
FIFO
Max concurrent jobs = 2
Extra jobs queued
```

Acceptance Criteria:

```text
Multiple jobs can be queued.
Only 2 run concurrently.
Queued jobs start when slot is free.
```

---

## 5.2 Worker State Manager

Responsibilities:

```text
Track current phase
Track processed rows
Track total rows
Track cancellation flag
Track heartbeat data
```

Acceptance Criteria:

```text
Running job status can be queried and pushed through WebSocket.
```

---

## 5.3 Site Code Parser

Input:

```text
Textbox content
```

Support:

```text
Newline separated
Comma separated
Space separated
```

Normalization:

```text
Trim
Uppercase
Remove hidden characters
Deduplicate
```

Acceptance Criteria:

```text
Duplicate site codes produce warning.
Normalized list is used for filtering.
```

---

## 5.4 iEPMS Export Parser

Library:

```text
xlsx / SheetJS
```

Responsibilities:

```text
Read workbook
Find required sheet
Read rows
Normalize column names
Extract site code column
Count rows
```

Acceptance Criteria:

```text
Parser can convert iEPMS export into structured rows.
```

---

## 5.5 Site Filtering Engine

Modes:

```text
site_code
all_sites
```

Rules:

```text
site_code mode: keep matched site rows
all_sites mode: pass eligible rows according to create-pr-cd process
unmatched site codes: warning
```

Acceptance Criteria:

```text
Filtered input file is generated for create-pr-cd execution.
Matched/unmatched counts are recorded.
```

---

## 5.6 Active Asset Loader

Responsibilities:

```text
Find active PR Model
Find active Contract Info
Find active ECC Template
Validate files exist
Return paths and versions
```

Acceptance Criteria:

```text
Job cannot start if any required active asset is missing.
```

---

## 5.7 Child Process Runner

Responsibilities:

```text
Prepare arguments
Spawn create-pr-cd process
Capture stdout
Capture stderr
Handle timeout
Handle non-zero exit code
Handle cancellation
```

Acceptance Criteria:

```text
create-pr-cd can be executed from backend worker.
Output files are generated in job folder.
```

---

## 5.8 Output Collector

Responsibilities:

```text
Scan output folder
Identify ECC files
Identify review report
Identify warning report
Create JobFile records
Create ZIP package
Update job summary
```

Acceptance Criteria:

```text
All generated files are tracked and downloadable.
```

---

## 5.9 Summary Builder

Responsibilities:

```text
Build Summary Dashboard data
Count requested sites
Count matched sites
Count unmatched sites
Count ECC files
Count REVIEW_REQUIRED
Count warnings
Count generated rows
```

Acceptance Criteria:

```text
Job Detail and Job History have required summary data.
```

---

## 5.10 Final Worker Summary Generator

Responsibilities:

```text
Prepare deterministic summary facts
Call LLM for human-style final summary
Fallback to template if LLM unavailable
Save finalWorkerSummary in Job
```

Acceptance Criteria:

```text
Each completed job has final worker summary.
LLM failure does not fail PR generation.
```

---

# EPIC 6 — WebSocket / Realtime Layer

## Objective

Implement live progress updates, heartbeat, reconnect support, and per-tab job subscription.

---

## 6.1 WebSocket Server

Deliverable:

```text
backend/src/websocket/server.js
```

Acceptance Criteria:

```text
Frontend can connect to WebSocket server.
```

---

## 6.2 Job Subscription

Client message:

```json
{
  "action": "subscribe",
  "jobId": "PR-20260520-001"
}
```

Acceptance Criteria:

```text
Client receives only subscribed job events.
```

---

## 6.3 Heartbeat Publisher

Interval:

```text
5 seconds
```

Acceptance Criteria:

```text
Running jobs emit heartbeat messages every 5 seconds.
```

---

## 6.4 Event Publisher

Major events:

```text
JOB_QUEUED
VALIDATION_STARTED
VALIDATION_COMPLETED
FILTERING_STARTED
FILTERING_COMPLETED
ASSET_LOADING_COMPLETED
GENERATION_STARTED
EXPORT_STARTED
JOB_COMPLETED
JOB_FAILED
JOB_CANCELLED
```

Acceptance Criteria:

```text
UI receives immediate updates for major events.
```

---

## 6.5 Reconnect Support

Behavior:

```text
Frontend reconnects
Reloads current job status
Subscribes again
Receives latest state
```

Acceptance Criteria:

```text
Browser refresh during running job resumes live status.
```

---

# EPIC 7 — LLM Layer

## Objective

Integrate internal MaaS LLM for worker persona, progress wording, final summary, and job Q&A.

---

## 7.1 LLM Client

Deliverable:

```text
backend/src/llm/llmClient.js
```

Provider:

```text
Internal MaaS Gateway
Qwen3-235B-A22B
```

Acceptance Criteria:

```text
Backend can send prompt and receive response.
LLM timeout is handled.
```

---

## 7.2 Worker Persona Prompt

Define PR Worker persona:

```text
English only
Professional corporate tone
Human collaboration feel
Moderately proactive
No business logic guessing
```

Acceptance Criteria:

```text
LLM responses are aligned with PR Worker persona.
```

---

## 7.3 Progress Message Generator

Input:

```text
System event
Job status
Progress facts
```

Output:

```text
Natural English worker message
```

Acceptance Criteria:

```text
System events can be converted into user-friendly PR Worker messages.
```

---

## 7.4 Final Summary Generator

Input:

```text
Processed rows
Generated files
Review count
Warning count
Unmatched site count
Download availability
```

Acceptance Criteria:

```text
Final worker summary is generated and saved.
```

---

## 7.5 Job Data Access Layer

Responsibilities:

```text
Retrieve job summary
Retrieve warnings
Retrieve review required items
Retrieve asset versions
Retrieve parsed job facts
Limit context to relevant data
```

Acceptance Criteria:

```text
LLM Q&A does not directly read raw Excel.
```

---

## 7.6 Re-Ask Q&A Service

Endpoint integration:

```http
POST /api/jobs/:jobId/ask
```

Acceptance Criteria:

```text
User can ask questions about job result.
Answer is based on job data.
Answer is not saved.
```

---

# EPIC 8 — Frontend User Portal

## Objective

Build Vue2 user interface for PR Worker, upload, pre-validation, site selection, generation, conversation panel, download, and job history.

---

## 8.1 Main Layout

Pages:

```text
PR Worker Home
Job History
Job Detail
Admin Login
Admin Portal
Health Dashboard
```

Acceptance Criteria:

```text
User can navigate between main pages.
```

---

## 8.2 PR Worker Home Page

Components:

```text
Worker intro card
File upload
Generation scope radio
Site code textarea
Pre-validation checklist
Generate button
Conversation panel
```

Acceptance Criteria:

```text
User can upload iEPMS export, pass validation, choose scope, and create job.
```

---

## 8.3 Site Code Input Component

Features:

```text
Textarea
Example placeholder
Duplicate warning display
Site count preview
```

Acceptance Criteria:

```text
User can paste site codes and see parsed count.
```

---

## 8.4 Generate All Sites Option

Behavior:

```text
If selected, site code textbox optional/disabled
If not selected, site codes required
```

Acceptance Criteria:

```text
Generate is blocked if no site code and Generate All is not selected.
```

---

## 8.5 Pre-validation Checklist UI

Display:

```text
Pass/fail items
Worker explanation
Generate button state
```

Acceptance Criteria:

```text
Invalid file shows clear reason and disabled Generate.
```

---

## 8.6 Conversation Panel

Behavior:

```text
Embedded bottom panel
Shows worker messages
Updates from WebSocket
Temporary only
```

Acceptance Criteria:

```text
User sees live progress messages during job execution.
```

---

## 8.7 Running Job View

Display:

```text
Status
Progress
Elapsed time
Cancel button
Current worker message
```

Acceptance Criteria:

```text
User can monitor and cancel running job.
```

---

## 8.8 Completion Result View

Display:

```text
Final worker summary
Summary metrics
ECC output files
Review Required link/table
Error/Warning report download
ZIP download
```

Acceptance Criteria:

```text
User can download generated output after completion.
```

---

# EPIC 9 — Job History and Job Detail UI

## Objective

Build permanent job history and full job detail pages.

---

## 9.1 Job History Page

UI style:

```text
Hybrid
Top: filter/search/summary stats
Bottom: job cards
```

Filters:

```text
Status
Date range
Search by job ID / file name
Worker type
```

Acceptance Criteria:

```text
User can browse historical jobs.
```

---

## 9.2 Job Card Component

Display:

```text
Worker name
Status
Job ID
Created time
Matched/unmatched sites
ECC file count
Review required count
Final worker summary preview
Open / Download / Report buttons
```

Acceptance Criteria:

```text
Job cards show enough information to identify job result quickly.
```

---

## 9.3 Job Detail Page

Sections:

```text
Job Summary
Final Worker Summary
ECC Output List
REVIEW_REQUIRED Table
Error / Warning Report
Asset Versions Used
Re-Ask PR Worker Panel
```

Acceptance Criteria:

```text
User can review full job result.
```

---

## 9.4 Re-Ask PR Worker UI

Behavior:

```text
Temporary Q&A
Not saved
Based on current Job Detail
```

Acceptance Criteria:

```text
User can ask questions and receive worker-style answer.
```

---

# EPIC 10 — Admin Portal UI

## Objective

Build Admin Portal for asset management, version history, audit logs, and health dashboard.

---

## 10.1 Admin Login Page

Features:

```text
Username
Password
Login button
Error message
```

Acceptance Criteria:

```text
Admin can login with preset account.
```

---

## 10.2 Admin Layout

Navigation:

```text
Assets
Audit Logs
Health Dashboard
Logout
```

Acceptance Criteria:

```text
Admin-only pages are protected.
```

---

## 10.3 Asset Management Page

Sections:

```text
PR Model versions
Contract Info versions
ECC Template versions
Upload new version
Activate version
Active version indicator
```

Acceptance Criteria:

```text
Admin can upload and activate assets.
```

---

## 10.4 Asset Upload Form

Fields:

```text
Asset Type
File upload
Upload button
```

Acceptance Criteria:

```text
Uploaded asset receives auto-generated version name.
```

---

## 10.5 Audit Log Page

Display:

```text
Timestamp
Admin
Action
Asset Type
Version
Status
IP
```

Acceptance Criteria:

```text
Admin can view asset and login audit history.
```

---

## 10.6 Health Dashboard Page

Display:

```text
Backend status
MongoDB status
Storage status
LLM status
Queue status
Active jobs
Queued jobs
Disk usage
```

Acceptance Criteria:

```text
Admin can quickly identify system health.
```

---

# EPIC 11 — Reports and Excel Output Layer

## Objective

Generate required reports and manage output packaging.

---

## 11.1 Error / Warning Report Excel

Library:

```text
ExcelJS
```

Content:

```text
Unmatched site codes
Duplicate site code input
Duplicate warnings
Resource warnings
Recoverable process warnings
```

Acceptance Criteria:

```text
Warning report is generated for completed jobs with warnings.
```

---

## 11.2 REVIEW_REQUIRED Report

Content:

```text
Site Code
Source Row
Scope
Subcon
Issue Type
Severity
Description
```

Acceptance Criteria:

```text
REVIEW_REQUIRED items are downloadable and visible in UI.
```

---

## 11.3 Summary Data Builder

Output:

```json
{
  "requestedSiteCount": 20,
  "matchedSiteCount": 18,
  "unmatchedSiteCount": 2,
  "eccFileCount": 4,
  "reviewRequiredCount": 6,
  "warningCount": 2
}
```

Acceptance Criteria:

```text
Summary Dashboard can render from summary JSON.
```

---

## 11.4 ZIP Package Generator

Library:

```text
archiver
```

ZIP content:

```text
ECC_Output/
Review_Required_Report.xlsx
Error_Warning_Report.xlsx
Summary.json
```

Acceptance Criteria:

```text
User can download all outputs in one ZIP.
```

---

# EPIC 12 — Health and Monitoring Layer

## Objective

Implement system status checks and admin-visible health dashboard data.

---

## 12.1 Backend Health Check

Endpoint:

```http
GET /health
```

Acceptance Criteria:

```text
Returns backend status and timestamp.
```

---

## 12.2 MongoDB Health Check

Acceptance Criteria:

```text
Health dashboard shows MongoDB connected/disconnected.
```

---

## 12.3 Storage Health Check

Checks:

```text
Storage folder exists
Writable
Available disk space
```

Acceptance Criteria:

```text
Health dashboard shows storage status and disk usage.
```

---

## 12.4 LLM Health Check

Checks:

```text
Can reach MaaS endpoint
Timeout handled
```

Acceptance Criteria:

```text
Health dashboard shows LLM status.
```

---

## 12.5 Queue Health Check

Display:

```text
Active jobs
Queued jobs
Max concurrency
```

Acceptance Criteria:

```text
Admin can see runtime workload.
```

---

# EPIC 13 — Resource Protection and Cleanup

## Objective

Protect system from large jobs and storage overload.

---

## 13.1 Hard Limit Enforcement

Limits:

```text
Max upload size: 100 MB
Max Excel rows: 50,000
Max site codes: 5,000
Max job timeout: 60 minutes
Max output files: 200
```

Acceptance Criteria:

```text
Over-limit job is rejected with clear explanation.
```

---

## 13.2 Job Timeout Handler

Acceptance Criteria:

```text
Job exceeding timeout is failed safely.
Partial outputs are handled according to policy.
```

---

## 13.3 File Cleanup Job

Policy:

```text
Delete files after 180 days
Keep metadata forever
```

Acceptance Criteria:

```text
Expired files can be identified and removed.
```

---

## 13.4 Expired File Handling

UI behavior:

```text
Show File Expired
Keep job summary visible
```

Acceptance Criteria:

```text
Old jobs with deleted files still open correctly.
```

---

# EPIC 14 — Deployment Layer

## Objective

Prepare deployment on Windows 11 Pro using Docker Desktop and Docker Compose.

---

## 14.1 Dockerfile for Backend

Acceptance Criteria:

```text
Backend runs inside Docker container.
```

---

## 14.2 Dockerfile for Frontend

Acceptance Criteria:

```text
Frontend builds and serves in container.
```

---

## 14.3 Docker Compose

Services:

```text
frontend
backend
mongodb
```

Volumes:

```text
storage
mongo-data
skills
```

Acceptance Criteria:

```text
docker compose up starts full MVP stack.
```

---

## 14.4 Windows Deployment Guide

Document:

```text
docs/deployment-windows.md
```

Include:

```text
Install Docker Desktop
Clone repo
Configure .env
Start containers
Access http://10.x.x.x:3000
Backup storage and MongoDB
```

Acceptance Criteria:

```text
A developer can deploy system from guide.
```

---

# EPIC 15 — Testing and QA

## Objective

Validate full system behavior before internal release.

---

## 15.1 Unit Tests — Backend Utilities

Scope:

```text
Job ID generator
Site code parser
Pre-validation
Asset version naming
Storage paths
```

Acceptance Criteria:

```text
Core utility functions are tested.
```

---

## 15.2 Integration Test — Job Flow

Test:

```text
Upload valid iEPMS export
Prevalidate
Create job
Run worker
Generate output
Download file
```

Acceptance Criteria:

```text
End-to-end PR Worker flow succeeds.
```

---

## 15.3 Integration Test — Site Code Edge Cases

Cases:

```text
Lowercase site code
Duplicate site code
Unmatched site code
No site code + no Generate All
Generate All Sites
```

Acceptance Criteria:

```text
All site selection behaviors match confirmed decisions.
```

---

## 15.4 Integration Test — Admin Asset Management

Cases:

```text
Admin login
Upload PR Model
Activate PR Model
Upload Contract Info
Upload ECC Template
Audit log created
```

Acceptance Criteria:

```text
Admin can manage system assets.
```

---

## 15.5 Integration Test — WebSocket

Cases:

```text
Connect
Subscribe job
Receive heartbeat
Receive major event
Reconnect after refresh
Independent multi-tab subscription
```

Acceptance Criteria:

```text
Realtime behavior works reliably.
```

---

## 15.6 Error Handling Tests

Cases:

```text
Invalid Excel
Missing required column
Missing active asset
create-pr-cd process fails
LLM timeout
Job timeout
Cancel running job
```

Acceptance Criteria:

```text
System fails gracefully and shows clear worker explanation.
```

---

## 15.7 User Acceptance Testing

UAT checklist:

```text
Business user can generate ECC without technical support.
User understands progress messages.
User can download outputs.
User can interpret Summary and REVIEW_REQUIRED.
Admin can update assets.
Job history is usable.
```

Acceptance Criteria:

```text
MVP accepted for internal trial.
```

---

# MVP Milestone Plan

## Milestone 1 — Foundation Ready

Includes:

```text
Repo structure
Backend skeleton
Frontend skeleton
MongoDB connection
Storage initialization
```

---

## Milestone 2 — Admin and Assets Ready

Includes:

```text
Admin login
Asset upload
Asset activate
Version history
Audit log
```

---

## Milestone 3 — Job Core Ready

Includes:

```text
Upload
Pre-validation
Create job
Queue
Site filtering
Active asset loading
```

---

## Milestone 4 — PR Worker Execution Ready

Includes:

```text
Child process runner
create-pr-cd execution
Output collection
Summary builder
Reports
ZIP download
```

---

## Milestone 5 — WebApp User Flow Ready

Includes:

```text
PR Worker page
Conversation panel
Job progress
Cancel job
Completion result
Download files
```

---

## Milestone 6 — Job History Ready

Includes:

```text
Job History
Job Detail
Re-Ask PR Worker
Expired file handling
```

---

## Milestone 7 — LLM and Worker Persona Ready

Includes:

```text
LLM client
Worker persona prompts
Progress messages
Final summary
Job Q&A
Fallback templates
```

---

## Milestone 8 — Deployment and UAT Ready

Includes:

```text
Docker Compose
Windows deployment guide
Health dashboard
Testing
UAT
```

---

# MVP Definition of Done

The MVP is complete when:

```text
1. User can open WebApp without login.
2. User can upload iEPMS export.
3. System pre-validates file and shows checklist.
4. User can enter site codes or select Generate All Sites.
5. Generate creates async job.
6. WebSocket shows worker progress.
7. System runs create-pr-cd through child process.
8. ECC files are generated.
9. Summary Dashboard is available.
10. REVIEW_REQUIRED list is available.
11. Error / Warning Report Excel is available.
12. Individual download and ZIP download work.
13. Job History is permanently saved.
14. Final Worker Summary is saved.
15. Job Detail can be opened.
16. Re-Ask PR Worker works without saving Q&A.
17. Admin can login.
18. Admin can upload and activate PR Model / Contract Info / ECC Template.
19. Asset version used by each job is recorded.
20. Admin audit log is recorded.
21. Health Dashboard is available.
22. Max 2 concurrent jobs are supported.
23. User can cancel running job.
24. Partial outputs are preserved after cancellation.
25. Files follow 180-day retention metadata.
26. System can be deployed on Windows 11 Pro through Docker Compose.
```

---

# Recommended Build Order Under Layered Strategy

Because the selected strategy is layered, the recommended build order is:

```text
1. Project Foundation
2. Database Models
3. Storage Service
4. Backend Core APIs
5. Admin Backend APIs
6. Admin Frontend
7. Job Queue and Worker Runner
8. PR Worker Child Process Integration
9. Report and Output Collector
10. WebSocket Layer
11. User Frontend PR Worker Page
12. Job History and Job Detail
13. LLM Layer
14. Health Dashboard
15. Docker Deployment
16. Testing and UAT
```

This order ensures the system foundation is stable before UI and AI behavior are layered on top.

