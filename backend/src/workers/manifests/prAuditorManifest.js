const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-af33b5a',
  engineCommit: 'af33b5a795af02ae606b0d0f6e742cc09a8f98a2',
  runtimeFingerprint: '71764a7ff07c02c23408200aa732f11bf9a3759c73d29654f29534f079131f8e',
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
