const { WORKER_DISPLAY_NAMES, WORKER_IDS } = require('../workerTypes');

module.exports = {
  workerId: WORKER_IDS.MW_PR,
  displayName: WORKER_DISPLAY_NAMES[WORKER_IDS.MW_PR],
  engineRepository: 'Gumb-D/create-pr-cd',
  engineVersion: 'approved-5ea40fe',
  engineCommit: '5ea40feaad733433ff89e108ebe6a9224376d6e1',
  runtimeFingerprint: '48dc99a99b76371d0a46a85a43b5fb37040a006456c538252aa138bb85b73f6f',
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
