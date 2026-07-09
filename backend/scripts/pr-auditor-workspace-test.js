const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running PR Auditor Workspace Tests ---');

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pr-auditor-workspace-'));
  const engineRoot = path.join(tempRoot, 'engine');
  const workspaceRoot = path.join(tempRoot, 'storage', 'jobs', 'PR-AUDIT-001');
  const finalPoSource = path.join(tempRoot, 'source-final-po.xlsx');
  const epmsSource = path.join(tempRoot, 'source-epms.xlsx');

  try {
    await fs.promises.mkdir(path.join(engineRoot, 'scripts'), { recursive: true });
    await fs.promises.mkdir(path.join(engineRoot, 'input'), { recursive: true });
    await fs.promises.writeFile(path.join(engineRoot, 'scripts', 'audit_final_po.py'), '# synthetic engine entry\n');
    await fs.promises.writeFile(path.join(engineRoot, 'input', 'should-not-copy.txt'), 'do not copy\n');
    await fs.promises.writeFile(finalPoSource, 'final');
    await fs.promises.writeFile(epmsSource, 'epms');

    setCachedModule(path.join(repoRoot, 'src/config/env.js'), {
      prAuditorRoot: engineRoot
    });
    setCachedModule(path.join(repoRoot, 'src/services/storageService.js'), {
      createJobFolders: async (jobId) => ({
        jobId,
        root: workspaceRoot,
        relativeRoot: `jobs/${jobId}`
      }),
      getJobRootPath: (jobId) => path.join(tempRoot, 'storage', 'jobs', jobId)
    });
    setCachedModule(path.join(repoRoot, 'src/utils/pathUtils.js'), {
      assertPathInsideRoot: (_root, targetPath) => path.resolve(targetPath)
    });

    const workspaceService = require('../src/workers/prAuditorWorkspaceService');
    const result = await workspaceService.preparePrAuditorWorkspace({
      jobId: 'PR-AUDIT-001',
      finalPoSourcePath: finalPoSource,
      epmsSourcePath: epmsSource
    });

    assert.strictEqual(result.workspaceRoot, workspaceRoot);
    assert.strictEqual(result.engineRoot, engineRoot);
    assert.strictEqual(result.relativeWorkspaceRoot, 'jobs/PR-AUDIT-001');
    assert.strictEqual(fs.existsSync(path.join(workspaceRoot, 'scripts', 'audit_final_po.py')), false);
    assert.strictEqual(result.runtimePaths.scriptPath, path.join(engineRoot, 'scripts', 'audit_final_po.py'));
    assert.strictEqual(fs.existsSync(path.join(workspaceRoot, 'input', 'should-not-copy.txt')), false, 'engine input fixtures must not be copied');
    assert.strictEqual(fs.existsSync(result.stagedInputs.finalPoPath), true);
    assert.strictEqual(fs.existsSync(result.stagedInputs.epmsPath), true);
    assert.strictEqual(path.basename(result.stagedInputs.finalPoPath), 'Final PO.xlsx');
    assert.strictEqual(path.basename(result.stagedInputs.epmsPath), 'EPMS.xlsx');
    assert.strictEqual(fs.existsSync(result.runtimePaths.expectedEccRoot), true);
    assert.strictEqual(path.basename(result.runtimePaths.expectedEccRoot), 'expected-ecc');
    assert.strictEqual(path.basename(result.runtimePaths.outputPath), 'PR_Audit_Result.xlsx');
    assert.strictEqual(path.basename(result.runtimePaths.summaryJsonPath), 'pr_audit_summary.json');

    console.log('--- PR Auditor Workspace Tests Passed! ---');
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
