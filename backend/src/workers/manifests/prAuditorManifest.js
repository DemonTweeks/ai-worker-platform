const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-aa98b9e',
  engineCommit: 'aa98b9ea760a9f37d0add41596af204fdee8095c',
  runtimeFingerprint: '4eda6bc62ca53614b3b7816f2dab6f85d3e52df1273eaeb712a63fe59837f830',
  runtimeFiles: [
    'config/du_registry.json',
    'scripts/audit_final_po.py'
  ],
  inputs: ['final-po-upload', 'epms-upload'],
  outputs: ['pr-audit-result-xlsx', 'pr-audit-summary'],
  capabilities: ['create-pr-cd-entitlement', 'final-po-audit'],
  limitations: ['create-pr-cd generation currently supports TSS and TI scopes'],
  compatibilityStatus: 'verified'
};
