const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-cba28b7',
  engineCommit: 'cba28b76716bf68f5fe8b03ac33c7e396c8935ee',
  inputs: ['final-po-upload', 'epms-upload'],
  outputs: ['pr-audit-result-xlsx', 'pr-audit-summary'],
  capabilities: ['create-pr-cd-entitlement', 'final-po-audit'],
  limitations: ['create-pr-cd generation currently supports TSS and TI scopes'],
  compatibilityStatus: 'verified'
};
