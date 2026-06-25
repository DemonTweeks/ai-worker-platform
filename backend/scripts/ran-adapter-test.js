const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const originalExistsSync = fs.existsSync;

const setCachedModule = (modulePath, exports) => {
  require.cache[require.resolve(modulePath)] = { exports };
};

const runTests = async () => {
  console.log('--- Running RAN Adapter Direct Coverage Tests ---');

  const stageCalls = [];
  const ingestions = [];
  const metadataUpdates = [];
  const trackedFiles = {
    ran_bom_upload: {
      jobId: 'RAN-JOB-001',
      fileType: 'ran_bom_upload',
      filePath: 'jobs/RAN-JOB-001/input/source-bom.xlsx'
    },
    ran_epms_upload: {
      jobId: 'RAN-JOB-001',
      fileType: 'ran_epms_upload',
      filePath: 'jobs/RAN-JOB-001/input/source-epms.xlsx'
    }
  };

  const cancellationStageCalls = [];

  fs.existsSync = (targetPath) => {
    const normalized = String(targetPath).replace(/\\/g, '/');
    if (normalized === 'C:/mock-storage/jobs/RAN-JOB-001/input/source-bom.xlsx') {
      return true;
    }
    if (normalized === 'C:/mock-storage/jobs/RAN-JOB-001/input/source-epms.xlsx') {
      return true;
    }
    return originalExistsSync(targetPath);
  };

  setCachedModule(path.join(repoRoot, 'src/models/index.js'), {
    Job: {
      findOne: async ({ jobId }) => ({
        jobId,
        runMode: 'general-item',
        selectedProject: 'Project Thanos'
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
    runPythonStage: async (spec) => {
      stageCalls.push(spec);
      const stageName = spec.scriptPath.replace(/\\/g, '/');
      if (stageName.endsWith('simple_ecc_export.py')) {
        return {
          exitCode: 0,
          stdout: 'ecc export complete',
          stderr: '',
          timedOut: false,
          cancelled: false
        };
      }

      return {
        exitCode: 0,
        stdout: `${stageName} complete`,
        stderr: '',
        timedOut: false,
        cancelled: false
      };
    }
  });

  setCachedModule(path.join(repoRoot, 'src/workers/ranProjectCatalogService.js'), {
    validateRanRunConfiguration: ({ runMode, selectedProject }) => ({
      runMode,
      selectedProject
    })
  });

  setCachedModule(path.join(repoRoot, 'src/workers/ranWorkspaceService.js'), {
    prepareRanWorkspace: async ({ jobId, bomSourcePath, epmsSourcePath }) => ({
      jobId,
      workspaceRoot: 'C:/mock-ran-workspaces/RAN-JOB-001',
      outputRoot: 'C:/mock-ran-workspaces/RAN-JOB-001/output',
      stagedInputs: {
        bomPath: bomSourcePath,
        epmsPath: epmsSourcePath
      }
    })
  });

  setCachedModule(path.join(repoRoot, 'src/workers/ranOutputIngestionService.js'), {
    ingestRanOutputs: async ({ jobId, workspaceOutputRoot }) => {
      ingestions.push({ jobId, workspaceOutputRoot });
      return {
        trackedFiles: [
          { fileType: 'ran_ecc_output', fileName: 'ECC_PR_Output.xlsx' },
          { fileType: 'ran_ecc_output_with_general_items', fileName: 'ECC_PR_Output_With_GeneralItems.xlsx' }
        ],
        outputFileCount: 2
      };
    }
  });

  const ranPrAdapter = require('../src/workers/adapters/ranPrAdapter');

  const successResult = await ranPrAdapter.run('RAN-JOB-001', {
    isCancellationRequested: () => false
  });

  assert.strictEqual(successResult.workerId, 'ran-pr');
  assert.strictEqual(successResult.runMode, 'general-item');
  assert.strictEqual(successResult.selectedProject, 'Project Thanos');
  assert.strictEqual(successResult.pipelineResult.cancelled, false);
  assert.strictEqual(successResult.outputCollection.outputFileCount, 2);
  assert.strictEqual(stageCalls.length, 4, 'all four RAN stages should run');
  assert.strictEqual(stageCalls[0].command, undefined, 'runPythonStage should receive pythonExecutable field, not command');
  assert.strictEqual(stageCalls[0].pythonExecutable, 'C:/Python311/python.exe');
  assert.strictEqual(stageCalls[2].scriptArgs.join(' '), '--selected-project Project Thanos');
  assert.strictEqual(stageCalls[2].env.SELECTED_PROJECT, 'Project Thanos');
  assert.strictEqual(stageCalls[0].cwd, 'C:/mock-ran-workspaces/RAN-JOB-001');
  assert.strictEqual(ingestions.length, 1, 'successful run should ingest approved outputs');
  assert.deepStrictEqual(metadataUpdates[0], {
    filter: { jobId: 'RAN-JOB-001' },
    update: {
      $set: {
        workerId: 'ran-pr',
        workerType: 'pr-worker',
        engineVersion: 'v1.0.0',
        engineCommit: '239910e2816153339a94881597bbb95355059741',
        runMode: 'general-item',
        selectedProject: 'Project Thanos'
      }
    }
  });

  setCachedModule(path.join(repoRoot, 'src/services/childProcessRunner.js'), {
    getExplicitPythonExecutable: () => 'C:/Python311/python.exe',
    runPythonStage: async (spec) => {
      cancellationStageCalls.push(spec);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
        cancelled: true
      };
    }
  });

  delete require.cache[require.resolve('../src/workers/adapters/ranPrAdapter')];
  const cancellationAdapter = require('../src/workers/adapters/ranPrAdapter');
  const cancelledResult = await cancellationAdapter.run('RAN-JOB-001', {
    isCancellationRequested: () => false
  });

  assert.strictEqual(cancelledResult.pipelineResult.cancelled, true, 'cancelled child stage should surface as cancelled');
  assert.strictEqual(cancelledResult.pipelineResult.stageResults.length, 1, 'cancelled stage run should stop after the first stage result');
  assert.strictEqual(cancellationStageCalls.length, 1, 'cooperative cancellation should stop further stage launches');
  assert.strictEqual(cancelledResult.outputCollection.outputFileCount, 2, 'cancelled run still returns platform-owned ingested outputs when present');

  console.log('--- RAN Adapter Direct Coverage Tests Passed! ---');
};

runTests().then(() => {
  fs.existsSync = originalExistsSync;
  process.exit(0);
}).catch((error) => {
  fs.existsSync = originalExistsSync;
  console.error('Test suite failed:', error);
  process.exit(1);
});
