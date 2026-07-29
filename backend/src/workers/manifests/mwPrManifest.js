const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.MW_PR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.MW_PR],
  engineRepository: 'Gumb-D/create-pr-cd',
  engineVersion: 'approved-a2026fd',
  engineCommit: 'a2026fd70ba3a83958422e5a18e93ae5a1dd850d',
  runtimeFingerprint: 'ad2748077b0fa4dce192b757e39c89887de28b0241130df20dfa8dbb42ebd0be',
  runtimeFiles: [
    'Info/input/contract_info_reference.md',
    'Info/input/ecc_template.xls',
    'Info/input/pr_model.xlsx',
    'Info/reference/geography_mapping.json',
    'Info/reference/sabah_sarawak_adm2.geojson',
    'scripts/generate_tss_pr_ecc.py',
    'scripts/geography_resolver.py',
    'scripts/pr_helpers.py'
  ],
  inputs: ['prevalidated-export', 'generation-scope', 'site-codes', 'pr-scope'],
  outputs: ['ecc-output', 'warning-report', 'review-required-report', 'zip-package'],
  capabilities: ['site-filtering', 'tss', 'ti'],
  limitations: [],
  compatibilityStatus: 'verified'
};
