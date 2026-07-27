const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running PR Auditor Output Ingestion Tests ---');

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pr-auditor-output-'));
  const workspaceOutputRoot = path.join(tempRoot, 'workspace-output');
  const storageOutputRoot = path.join(tempRoot, 'storage-output');
  const jobUpdates = [];
  const createdFiles = [];

  try {
    await fs.promises.mkdir(workspaceOutputRoot, { recursive: true });
    await fs.promises.mkdir(storageOutputRoot, { recursive: true });
    await fs.promises.writeFile(path.join(workspaceOutputRoot, 'PR_Audit_Result.xlsx'), 'synthetic report');
    await fs.promises.writeFile(
      path.join(workspaceOutputRoot, 'pr_audit_summary.json'),
      JSON.stringify({
        total_rows: 10,
        classifications: {
          Normal: 4,
          'Abnormal - Invalid PO': 1,
          'Abnormal - Wrong PO': 2,
          'Abnormal - Duplicate PO': 3
        },
        reason_codes: {
          NORMAL_FULL: 4,
          INVALID_SUBCON_CHANGED: 1,
          WRONG_LINE_ITEM_MAPPING: 2,
          DUPLICATE_FULL_QUANTITY: 3
        }
      }, null, 2)
    );
    await fs.promises.writeFile(path.join(workspaceOutputRoot, 'ignore-me.txt'), 'not approved');

    setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
      Job: {
        updateOne: async (filter, update) => {
          jobUpdates.push({ filter, update });
          return { ok: 1, nModified: 1 };
        }
      },
      JobFile: {
        deleteMany: async () => ({ deletedCount: 0 }),
        create: async (payload) => {
          createdFiles.push(payload);
          return {
            _id: `${payload.fileType}-id`,
            ...payload
          };
        }
      }
    });
    setCachedModule(path.join(repoRoot, 'src/services/storageService.js'), {
      resolveJobOutputPath: (_jobId, fileName) => path.join(storageOutputRoot, fileName),
      buildFileMetadata: async (filePath) => {
        const stats = await fs.promises.stat(filePath);
        return {
          fileName: path.basename(filePath),
          filePath,
          fileSize: stats.size,
          retentionUntil: null
        };
      }
    });
    setCachedModule(path.join(repoRoot, 'src/utils/pathUtils.js'), {
      assertPathInsideRoot: (_root, targetPath) => path.resolve(targetPath)
    });

    const ingestionService = require('../src/workers/prAuditorOutputIngestionService');
    const result = await ingestionService.ingestPrAuditorOutputs({
      jobId: 'PR-AUDIT-001',
      workspaceOutputRoot
    });

    assert.strictEqual(result.outputFileCount, 1);
    assert.strictEqual(result.trackedFiles.length, 2, 'only the approved report and summary artifacts should be tracked');
    assert.strictEqual(result.failure, null);
    assert.deepStrictEqual(result.auditSummary, {
      normalCount: 4,
      invalidPoCount: 1,
      wrongPoCount: 2,
      duplicatePoCount: 3,
      reviewRequiredCount: 0,
      warnings: []
    });
    assert.deepStrictEqual(
      createdFiles.map((file) => file.fileType).sort(),
      ['pr_audit_result_xlsx', 'pr_audit_summary_json']
    );
    assert.deepStrictEqual(jobUpdates[0], {
      filter: { jobId: 'PR-AUDIT-001' },
      update: {
        $set: {
          outputFileCount: 1,
          reviewRequiredCount: 0,
          warningCount: 0,
          auditSummary: {
            normalCount: 4,
            invalidPoCount: 1,
            wrongPoCount: 2,
            duplicatePoCount: 3,
            reviewRequiredCount: 0,
            warnings: []
          }
        }
      }
    });

    assert.deepStrictEqual(ingestionService.normalizeAuditSummary({
      normalCount: 1,
      invalidPoCount: 2,
      wrongPoCount: 3,
      duplicatePoCount: 4,
      reviewRequiredCount: 5,
      warnings: ['legacy-warning']
    }), {
      normalCount: 1,
      invalidPoCount: 2,
      wrongPoCount: 3,
      duplicatePoCount: 4,
      reviewRequiredCount: 5,
      warnings: ['legacy-warning']
    }, 'the previous trusted sidecar contract should remain supported');

    assert.strictEqual(ingestionService.normalizeAuditSummary({
      total_rows: 1,
      classifications: { 'Unknown Classification': 1 }
    }), null, 'unknown current-engine classifications must fail closed');

    jobUpdates.length = 0;
    createdFiles.length = 0;

    const sameRootResult = await ingestionService.ingestPrAuditorOutputs({
      jobId: 'PR-AUDIT-001',
      workspaceOutputRoot: storageOutputRoot
    });

    assert.strictEqual(sameRootResult.outputFileCount, 1, 'job output root should be valid as the runtime output root');
    assert.strictEqual(sameRootResult.trackedFiles.length, 2);
    assert.strictEqual(sameRootResult.failure, null);
    assert.deepStrictEqual(
      createdFiles.map((file) => file.fileType).sort(),
      ['pr_audit_result_xlsx', 'pr_audit_summary_json']
    );

    console.log('--- PR Auditor Output Ingestion Tests Passed! ---');
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
