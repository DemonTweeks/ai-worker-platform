const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const originalExistsSync = fs.existsSync;

const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running PR Auditor Adapter Direct Coverage Tests ---');

  const metadataUpdates = [];
  const workspaceCalls = [];
  const trackedFiles = {
    pr_auditor_final_po_upload: {
      jobId: 'PR-AUDIT-001',
      fileType: 'pr_auditor_final_po_upload',
      filePath: 'jobs/PR-AUDIT-001/input/source-final-po.xlsx'
    },
    pr_auditor_epms_upload: {
      jobId: 'PR-AUDIT-001',
      fileType: 'pr_auditor_epms_upload',
      filePath: 'jobs/PR-AUDIT-001/input/source-epms.xlsx'
    },
    pr_auditor_pr_model_upload: {
      jobId: 'PR-AUDIT-001',
      fileType: 'pr_auditor_pr_model_upload',
      filePath: 'jobs/PR-AUDIT-001/input/source-pr-model.xlsx'
    }
  };

  fs.existsSync = (targetPath) => {
    const normalized = String(targetPath).replace(/\\/g, '/');
    if (normalized === 'C:/mock-storage/jobs/PR-AUDIT-001/input/source-final-po.xlsx') {
      return true;
    }
    if (normalized === 'C:/mock-storage/jobs/PR-AUDIT-001/input/source-epms.xlsx') {
      return true;
    }
    if (normalized === 'C:/mock-storage/jobs/PR-AUDIT-001/input/source-pr-model.xlsx') {
      return true;
    }
    return originalExistsSync(targetPath);
  };

  setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
    Job: {
      findOne: async ({ jobId }) => ({
        jobId
      }),
      updateOne: async (filter, update) => {
        metadataUpdates.push({ filter, update });
        return { ok: 1, nModified: 1 };
      }
    },
    JobFile: {
      findOne: ({ fileType }) => ({
        sort: () => ({
          lean: async () => trackedFiles[fileType] || null
        })
      })
    }
  });

  setCachedModule(path.join(repoRoot, 'src/services/storageService.js'), {
    getStorageRoot: () => 'C:/mock-storage'
  });

  setCachedModule(path.join(repoRoot, 'src/services/childProcessRunner.js'), {
    getExplicitPythonExecutable: () => 'C:/Python311/python.exe',
    runPythonStage: async () => {
      throw new Error('runPythonStage should not be called when engine pin is unapproved.');
    }
  });

  setCachedModule(path.join(repoRoot, 'src/workers/prAuditorWorkspaceService.js'), {
    preparePrAuditorWorkspace: async ({ jobId, finalPoSourcePath, epmsSourcePath, prModelSourcePath }) => {
      workspaceCalls.push({ jobId, finalPoSourcePath, epmsSourcePath, prModelSourcePath });
      return {
        jobId,
        workspaceRoot: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001',
        outputRoot: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/output',
        runtimePaths: {
          finalPoPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/Final PO.xlsx',
          epmsPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/EPMS.xlsx',
          prModelPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/pr_model.xlsx',
          outputPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/output/PR_Audit_Result.xlsx',
          summaryJsonPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/output/pr_audit_summary.json',
          scriptPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/scripts/audit_final_po.py'
        },
        stagedInputs: {
          finalPoPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/Final PO.xlsx',
          epmsPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/EPMS.xlsx',
          prModelPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/pr_model.xlsx'
        }
      };
    }
  });

  const prAuditorAdapter = require('../src/workers/adapters/prAuditorAdapter');

  await assert.rejects(
    () => prAuditorAdapter.run('PR-AUDIT-001', {
      isCancellationRequested: () => false
    }),
    (error) => {
      assert.strictEqual(error.code, 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED');
      return true;
    }
  );

  assert.strictEqual(workspaceCalls.length, 1, 'adapter should still prepare an isolated workspace before closed-gate failure');
  assert.deepStrictEqual(metadataUpdates[0], {
    filter: { jobId: 'PR-AUDIT-001' },
    update: {
      $set: {
        workerId: 'pr-auditor',
        workerType: 'pr-worker',
        engineVersion: 'pending-safe-pin',
        engineCommit: 'unapproved',
        runMode: null,
        selectedProject: null
      }
    }
  });

  const commandSpec = prAuditorAdapter.buildAuditCommandSpec({
    workspaceRoot: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001',
    runtimePaths: {
      finalPoPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/Final PO.xlsx',
      epmsPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/EPMS.xlsx',
      prModelPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/pr_model.xlsx',
      outputPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/output/PR_Audit_Result.xlsx',
      summaryJsonPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/output/pr_audit_summary.json',
      scriptPath: 'C:/mock-pr-auditor-workspaces/PR-AUDIT-001/scripts/audit_final_po.py'
    },
    pythonExecutable: 'C:/Python311/python.exe'
  });

  assert.strictEqual(commandSpec.pythonExecutable, 'C:/Python311/python.exe');
  assert(commandSpec.scriptArgs.includes('--final-po'));
  assert(commandSpec.scriptArgs.includes('C:/mock-pr-auditor-workspaces/PR-AUDIT-001/input/Final PO.xlsx'));
  assert(commandSpec.scriptArgs.includes('--summary-json'));

  console.log('--- PR Auditor Adapter Direct Coverage Tests Passed! ---');
};

runTests().then(() => {
  fs.existsSync = originalExistsSync;
  process.exit(0);
}).catch((error) => {
  fs.existsSync = originalExistsSync;
  console.error('Test suite failed:', error);
  process.exit(1);
});
