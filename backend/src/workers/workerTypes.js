const WORKER_IDS = {
  MW_PR: 'mw-pr',
  RAN_PR: 'ran-pr'
};

const WORKER_DISPLAY_NAMES = {
  [WORKER_IDS.MW_PR]: 'MW PR Worker',
  [WORKER_IDS.RAN_PR]: 'RAN PR Worker'
};

const RAN_RUN_MODES = {
  STANDARD_PR: 'standard-pr',
  GENERAL_ITEM: 'general-item'
};

module.exports = {
  RAN_RUN_MODES,
  WORKER_DISPLAY_NAMES,
  WORKER_IDS
};
