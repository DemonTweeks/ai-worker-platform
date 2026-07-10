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
  const stageCalls = [];
  const ingestionCalls = [];
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
    buildCommand: ({ siteDataPath, outputPath, scope }) => ({
      command: 'C:/Python311/python.exe',
      args: ['generate_tss_pr_ecc.py', '--site-data', siteDataPath, '--output', outputPath, '--scope', scope, '--all-sites'],
      cwd: 'C:/mock-skills/create-pr-cd'
    }),
    getExplicitPythonExecutable: () => 'C:/Python311/python.exe',
    runCommand: async (spec) => {
      stageCalls.push(spec);
      return {
        exitCode: 0,
        stdout: 'generated',
        stderr: '',
        timedOut: false,
        cancelled: false
      };
    },
    runPythonStage: async (spec) => {
      stageCalls.push(spec);
      return {
        exitCode: 0,
        stdout: '{"total_rows":1}',
        stderr: '',
        timedOut: false,
        cancelled: false
      };
    }
  });

  setCachedModule(path.join(repoRoot, 'src/workers/prAuditorOutputIngestionService.js'), {
    ingestPrAuditorOutputs: async (input) => {
      ingestionCalls.push(input);
      return {
        outputFileCount: 1,
        auditSummary: null,
        failure: null,
        trackedFiles: []
      };
    }
  });

  setCachedModule(path.join(repoRoot, 'src/workers/prAuditorWorkspaceService.js'), {
    preparePrAuditorWorkspace: async ({ jobId, finalPoSourcePath, epmsSourcePath }) => {
      workspaceCalls.push({ jobId, finalPoSourcePath, epmsSourcePath });
      return {
        jobId,
        workspaceRoot: 'C:/mock-storage/jobs/PR-AUDIT-001',
        outputRoot: 'C:/mock-storage/jobs/PR-AUDIT-001/output',
        runtimePaths: {
          finalPoPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/Final PO.xlsx',
          epmsPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/EPMS.xlsx',
          expectedEccRoot: 'C:/mock-storage/jobs/PR-AUDIT-001/expected-ecc',
          outputPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/PR_Audit_Result.xlsx',
          summaryJsonPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/pr_audit_summary.json',
          scriptPath: 'C:/mock-skills/tx-pr-auditor/scripts/audit_final_po.py'
        },
        stagedInputs: {
          finalPoPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/Final PO.xlsx',
          epmsPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/EPMS.xlsx'
        }
      };
    }
  });

  const prAuditorAdapter = require('../src/workers/adapters/prAuditorAdapter');

  const runResult = await prAuditorAdapter.run('PR-AUDIT-001', {
    isCancellationRequested: () => false
  });

  assert.strictEqual(workspaceCalls.length, 1, 'adapter should prepare an isolated workspace');
  assert.strictEqual(runResult.workerId, 'pr-auditor');
  assert.strictEqual(runResult.manifest.compatibilityStatus, 'verified');
  assert.notStrictEqual(runResult.manifest.engineCommit, 'unapproved');
  assert(runResult.runtime.commandSpec.scriptArgs.includes('--expected-ecc'));
  assert.strictEqual(stageCalls.length, 3, 'adapter should generate TSS and TI ECC before auditing');
  assert(stageCalls[0].args.includes('TSS'));
  assert(stageCalls[1].args.includes('TI'));
  assert.strictEqual(stageCalls[2].pythonExecutable, 'C:/Python311/python.exe');
  assert.strictEqual(stageCalls[2].scriptPath, 'C:/mock-skills/tx-pr-auditor/scripts/audit_final_po.py');
  assert(!stageCalls[2].scriptArgs.includes('--final-po-sheet'), 'default execution should auto-detect the Final PO sheet');
  assert(!stageCalls[2].scriptArgs.includes('--final-po-header-row'), 'default execution should auto-detect the Final PO header row');
  assert.strictEqual(ingestionCalls.length, 1, 'adapter should ingest PR Auditor outputs before returning');
  assert.strictEqual(ingestionCalls[0].workspaceOutputRoot, 'C:/mock-storage/jobs/PR-AUDIT-001/output');
  assert.strictEqual(runResult.outputCollection.outputFileCount, 1);
  assert.deepStrictEqual(metadataUpdates[0], {
    filter: { jobId: 'PR-AUDIT-001' },
    update: {
      $set: {
        workerId: 'pr-auditor',
        workerType: 'pr-worker',
        engineVersion: 'approved-bb19525',
        engineCommit: 'bb19525ab39e55866ff330352ce2a52a400fec17',
        runMode: null,
        selectedProject: null
      }
    }
  });

  const commandSpec = prAuditorAdapter.buildAuditCommandSpec({
    workspaceRoot: 'C:/mock-storage/jobs/PR-AUDIT-001',
    runtimePaths: {
      finalPoPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/Final PO.xlsx',
      epmsPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/EPMS.xlsx',
      expectedEccRoot: 'C:/mock-storage/jobs/PR-AUDIT-001/expected-ecc',
      outputPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/PR_Audit_Result.xlsx',
      summaryJsonPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/pr_audit_summary.json',
      scriptPath: 'C:/mock-skills/tx-pr-auditor/scripts/audit_final_po.py'
    },
    pythonExecutable: 'C:/Python311/python.exe'
  });

  assert.strictEqual(commandSpec.pythonExecutable, 'C:/Python311/python.exe');
  assert.strictEqual(commandSpec.scriptPath, 'C:/mock-skills/tx-pr-auditor/scripts/audit_final_po.py');
  assert(commandSpec.scriptArgs.includes('--final-po'));
  assert(commandSpec.scriptArgs.includes('C:/mock-storage/jobs/PR-AUDIT-001/input/Final PO.xlsx'));
  assert(!commandSpec.scriptArgs.includes('--final-po-sheet'));
  assert(!commandSpec.scriptArgs.includes('--final-po-header-row'));
  assert(commandSpec.scriptArgs.includes('--expected-ecc'));
  assert(commandSpec.scriptArgs.includes('C:/mock-storage/jobs/PR-AUDIT-001/expected-ecc'));
  assert(commandSpec.scriptArgs.includes('--summary-json'));

  const overriddenCommandSpec = prAuditorAdapter.buildAuditCommandSpec({
    workspaceRoot: 'C:/mock-storage/jobs/PR-AUDIT-001',
    runtimePaths: {
      finalPoPath: 'C:/mock-storage/jobs/PR-AUDIT-001/input/Final PO.xlsx',
      expectedEccRoot: 'C:/mock-storage/jobs/PR-AUDIT-001/expected-ecc',
      outputPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/PR_Audit_Result.xlsx',
      summaryJsonPath: 'C:/mock-storage/jobs/PR-AUDIT-001/output/pr_audit_summary.json',
      scriptPath: 'C:/mock-skills/tx-pr-auditor/scripts/audit_final_po.py'
    },
    pythonExecutable: 'C:/Python311/python.exe',
    finalPoLayout: {
      sheet: 'Sheet1',
      headerRow: '2'
    }
  });
  assert(overriddenCommandSpec.scriptArgs.includes('--final-po-sheet'));
  assert(overriddenCommandSpec.scriptArgs.includes('Sheet1'));
  assert(overriddenCommandSpec.scriptArgs.includes('--final-po-header-row'));
  assert(overriddenCommandSpec.scriptArgs.includes('2'));

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
