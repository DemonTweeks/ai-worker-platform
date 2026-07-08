const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running PR Auditor Summary Metadata Tests ---');

  setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
    Job: {
      findOne: () => ({
        lean: async () => ({
          jobId: 'PR-AUDIT-001',
          workerId: 'pr-auditor',
          workerType: 'pr-worker',
          status: 'completed',
          outputFileCount: 1,
          warningCount: 2,
          reviewRequiredCount: 5,
          auditSummary: {
            normalCount: 4,
            invalidPoCount: 1,
            wrongPoCount: 2,
            duplicatePoCount: 3,
            reviewRequiredCount: 5,
            warnings: ['warning-a', 'warning-b']
          },
          finalWorkerSummary: ''
        })
      })
    },
    JobFile: {
      countDocuments: async ({ fileType }) => (
        Array.isArray(fileType && fileType.$in) && fileType.$in.includes('pr_audit_result_xlsx') ? 1 : 0
      )
    },
    ReviewRequiredItem: {
      countDocuments: async () => 0
    },
    WarningItem: {
      countDocuments: async () => 0
    }
  });

  const { buildSummaryData } = require('../src/services/reportGenerator');
  const { buildFinalSummary } = require('../src/services/finalSummaryService');

  const summary = await buildSummaryData('PR-AUDIT-001');
  assert.deepStrictEqual(summary.auditSummary, {
    normalCount: 4,
    invalidPoCount: 1,
    wrongPoCount: 2,
    duplicatePoCount: 3,
    reviewRequiredCount: 5,
    warnings: ['warning-a', 'warning-b']
  });
  assert.strictEqual(summary.outputFileCount, 1);

  const text = buildFinalSummary({
    job: {
      workerId: 'pr-auditor',
      status: 'completed'
    },
    summary
  });

  assert(text.includes('Audit report generated.'), 'PR Auditor final summary should confirm audit report generation');
  assert(text.includes('Normal: 4'), 'PR Auditor final summary should include Normal count');
  assert(text.includes('Invalid PO: 1'), 'PR Auditor final summary should include Invalid PO count');
  assert(text.includes('Wrong PO: 2'), 'PR Auditor final summary should include Wrong PO count');
  assert(text.includes('Duplicate PO: 3'), 'PR Auditor final summary should include Duplicate PO count');
  assert(text.includes('Review Required: 5'), 'PR Auditor final summary should include Review Required count');
  assert(text.includes('Download Audit Report'), 'PR Auditor final summary should reference the audit report download action');

  console.log('--- PR Auditor Summary Metadata Tests Passed! ---');
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
