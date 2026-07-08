const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.PR_AUDITOR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.PR_AUDITOR],
  engineRepository: 'BL2ZteSolution/tx-pr-auditor',
  engineVersion: 'approved-bb19525',
  engineCommit: 'bb19525ab39e55866ff330352ce2a52a400fec17',
  inputs: ['final-po-upload', 'expected-ecc-upload'],
  outputs: ['pr-audit-result-xlsx', 'pr-audit-summary'],
  capabilities: ['final-po-audit'],
  limitations: ['browser upload accepts generated ECC workbooks, not ECC directories'],
  compatibilityStatus: 'verified'
};
