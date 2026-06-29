const { RAN_RUN_MODES, WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.RAN_PR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.RAN_PR],
  engineRepository: 'ammarofficial11/create-pr-cd-ran',
  engineVersion: 'v1.0.0',
  engineCommit: '239910e2816153339a94881597bbb95355059741',
  inputs: ['bom-upload', 'epms-upload', 'run-mode', 'selected-project'],
  outputs: [
    'simple-normalized-json',
    'simple-calculated-json',
    'simple-pr-output-json',
    'general-pr-output-json',
    'ecc-pr-output-xlsx',
    'ecc-pr-output-with-general-items-xlsx',
    'zip-package'
  ],
  capabilities: [RAN_RUN_MODES.STANDARD_PR, RAN_RUN_MODES.GENERAL_ITEM],
  limitations: ['bom-comparison not implemented'],
  compatibilityStatus: 'verified'
};
