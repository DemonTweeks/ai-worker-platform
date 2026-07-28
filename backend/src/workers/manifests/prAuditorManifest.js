const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-abf3316',
  engineCommit: 'abf3316af47ff35ff653f5b680d381a32ae3c49a',
  runtimeFingerprint: 'd54a628af9fe97a2be266f37aac75253ff5a9c8f36764fa0396e206fb8276851',
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
