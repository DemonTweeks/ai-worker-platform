const assert = require('assert');
const { resolveEngineSiteCodes } = require('../src/services/prWorkerService');

const runTests = () => {
  console.log('--- Running PR Worker Site-Code Handoff Tests ---');

  assert.deepStrictEqual(
    resolveEngineSiteCodes({
      generationScope: 'site_code',
      requestedSiteCodes: ['MATCHED001', 'MISSING001'],
      matchedSiteCodes: ['MATCHED001']
    }),
    ['MATCHED001'],
    'site_code generation must pass only platform-matched site codes to create-pr-cd'
  );

  assert.deepStrictEqual(
    resolveEngineSiteCodes({
      generationScope: 'all_sites',
      requestedSiteCodes: [],
      matchedSiteCodes: ['MATCHED001']
    }),
    [],
    'all_sites generation must preserve its existing empty site-code payload'
  );

  console.log('--- PR Worker Site-Code Handoff Tests Passed! ---');
};

try {
  runTests();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
