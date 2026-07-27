const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-0339ab7',
  engineCommit: '0339ab7a009bb0de8a43e93941d0fe2b9f018a06',
  runtimeFingerprint: 'eed1a6247b83cc8cefdf2a29aab0bfa3f03d3ef890ffe9a56d724094baff3432',
  runtimeFiles: ['scripts/audit_final_po.py'],
  inputs: ['final-po-upload', 'epms-upload'],
  outputs: ['pr-audit-result-xlsx', 'pr-audit-summary'],
  capabilities: ['create-pr-cd-entitlement', 'final-po-audit'],
  limitations: ['create-pr-cd generation currently supports TSS and TI scopes'],
  compatibilityStatus: 'verified'
};
