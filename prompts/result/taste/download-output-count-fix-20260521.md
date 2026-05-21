# Download Output Count Fix - Process Log

## Objective
Fix incorrect Download card output count display in HomeView.vue. The Download card top-right was showing incorrect output count (e.g., 6 outputs) when actual generated output files were fewer (e.g., 3 files).

## Root Cause
The `outputCount` computed property in `HomeView.vue` was using `jobDetail.outputs.length` as the source of truth. However, `jobDetail.outputs` includes all output files such as:
- ZIP package files
- Report files
- Support files
- Other non-business output files

This caused the count to be inflated compared to the business-generated output count.

## Files Changed
- `frontend/src/views/HomeView.vue` - Updated `outputCount` computed property

## Fix Implemented
Updated the `outputCount` computed property logic to:
1. Primary: Use `jobDetail.job.outputFileCount` when available (business-generated output count)
2. Fallback: Use `jobDetail.outputs.length` when `outputFileCount` is missing/null
3. Default: Return 0 if neither is available

### Before:
```javascript
outputCount() {
  return this.jobDetail && this.jobDetail.outputs ? this.jobDetail.outputs.length : 0;
}
```

### After:
```javascript
outputCount() {
  if (this.jobDetail && this.jobDetail.job && this.hasValue(this.jobDetail.job.outputFileCount)) {
    return this.jobDetail.job.outputFileCount;
  }
  return this.jobDetail && this.jobDetail.outputs ? this.jobDetail.outputs.length : 0;
}
```

## Confirmation Backend Unchanged
- No backend files were modified
- No API contract changes
- No WebSocket changes
- No database schema changes
- No route changes

## Build/Test Result
- Run `npm run build` in frontend directory
- Run `npm run test` in frontend directory

## Known Limitations
- If `jobDetail.job.outputFileCount` is not populated by the backend, the fallback to `jobDetail.outputs.length` will be used
- This fix assumes the backend correctly populates `outputFileCount` in the job object

## Git Branch
To be determined after commit

## Git Commit Hash
To be determined after commit

## Push Status
To be determined after push