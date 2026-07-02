const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'pending-safe-pin',
  engineCommit: 'unapproved',
  inputs: ['final-po-upload', 'epms-upload', 'pr-model-upload'],
  outputs: ['pr-audit-result-xlsx', 'pr-audit-summary'],
  capabilities: ['final-po-audit'],
  limitations: ['engine pin pending data-safety review'],
  compatibilityStatus: 'pending_safe_pin'
};
