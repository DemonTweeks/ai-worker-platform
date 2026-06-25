const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.MW_PR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.MW_PR],
  engineRepository: 'internal',
  engineVersion: 'platform-current',
  engineCommit: 'platform-current',
  inputs: ['prevalidated-export', 'generation-scope', 'site-codes', 'pr-scope'],
  outputs: ['ecc-output', 'warning-report', 'review-required-report', 'zip-package'],
  capabilities: ['site-filtering', 'tss', 'ti'],
  limitations: [],
  compatibilityStatus: 'verified'
};
