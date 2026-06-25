const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fsPromises = require('fs').promises;

// Mock dependencies in require.cache before requiring prWorkerService
const mockIepmsParser = {
  parseIepmsWorkbook: () => {
    return { rowCount: 1 };
  }
};
require.cache[require.resolve('../src/services/iepmsParser')] = {
  exports: mockIepmsParser
};

const mockSiteFilteringService = {
  filterSites: async () => {
    return {
      filteredRows: [],
      filteredMetadata: { absolutePath: 'filtered.xlsx' }
    };
  }
};
require.cache[require.resolve('../src/services/siteFilteringService')] = {
  exports: mockSiteFilteringService
};

const mockEventPublisher = {
  JOB_EVENTS: {
    VALIDATION_COMPLETED: 'VALIDATION_COMPLETED',
    FILTERING_COMPLETED: 'FILTERING_COMPLETED',
    GENERATION_COMPLETED: 'GENERATION_COMPLETED',
    JOB_CANCELLED: 'JOB_CANCELLED',
    JOB_COMPLETED: 'JOB_COMPLETED'
  },
  publishJobEvent: async () => ({}),
  publishHeartbeat: async () => ({})
};
require.cache[require.resolve('../src/websocket/eventPublisher')] = {
  exports: mockEventPublisher
};

// Now import the services
const childProcessRunner = require('../src/services/childProcessRunner');
const prWorkerService = require('../src/services/prWorkerService');
const storageService = require('../src/services/storageService');
const { Job, JobFile } = require('../src/models');

const runTests = async () => {
  console.log('--- Running Preflight and Python Resolution Unit Tests ---');

  const originalEnvPython = process.env.PYTHON_EXECUTABLE;
  const originalExistsSync = fs.existsSync;
  const originalPlatform = process.platform;
  const originalRunCommand = childProcessRunner.runCommand;

  const originalJobFindOne = Job.findOne;
  const originalJobFileFindOne = JobFile.findOne;
  const originalJobUpdateOne = Job.updateOne;
  const originalJobFileCreate = JobFile.create;

  const resetMocks = () => {
    delete process.env.PYTHON_EXECUTABLE;
    fs.existsSync = originalExistsSync;
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    childProcessRunner.runCommand = originalRunCommand;

    Job.findOne = originalJobFindOne;
    JobFile.findOne = originalJobFileFindOne;
    Job.updateOne = originalJobUpdateOne;
    JobFile.create = originalJobFileCreate;
  };

  try {
    // Test 1: Environment-variable priority
    console.log('Scenario 1: Environment-variable priority');
    resetMocks();
    process.env.PYTHON_EXECUTABLE = 'custom_python_from_env';
    let resolved = childProcessRunner.getPythonExecutable();
    assert.strictEqual(resolved, 'custom_python_from_env', 'Should prioritize process.env.PYTHON_EXECUTABLE');

    // Test 2: Local .venv preference (Windows)
    console.log('Scenario 2: Local .venv preference (Windows)');
    resetMocks();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    fs.existsSync = (p) => {
      if (p.endsWith(path.join('.venv', 'Scripts', 'python.exe'))) {
        return true;
      }
      return false;
    };
    resolved = childProcessRunner.getPythonExecutable();
    assert(resolved.endsWith(path.join('.venv', 'Scripts', 'python.exe')), 'Should prefer local .venv python.exe on Windows');

    // Test 3: Local .venv preference (Linux/macOS)
    console.log('Scenario 3: Local .venv preference (Linux/macOS)');
    resetMocks();
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    fs.existsSync = (p) => {
      if (p.endsWith(path.join('.venv', 'bin', 'python'))) {
        return true;
      }
      return false;
    };
    resolved = childProcessRunner.getPythonExecutable();
    assert(resolved.endsWith(path.join('.venv', 'bin', 'python')), 'Should prefer local .venv python on Linux/macOS');

    // Test 4: Platform fallback (Windows)
    console.log('Scenario 4: Platform fallback (Windows)');
    resetMocks();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    fs.existsSync = () => false;
    resolved = childProcessRunner.getPythonExecutable();
    assert.strictEqual(resolved, 'python', 'Should fallback to python on Windows');

    // Test 5: Platform fallback (Linux/macOS)
    console.log('Scenario 5: Platform fallback (Linux/macOS)');
    resetMocks();
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    fs.existsSync = () => false;
    resolved = childProcessRunner.getPythonExecutable();
    assert.strictEqual(resolved, 'python3', 'Should fallback to python3 on Linux/macOS');

    // Test 6: Missing dependency preflight behavior
    console.log('Scenario 6: Missing dependency preflight behavior');
    resetMocks();
    childProcessRunner.runCommand = async () => {
      return {
        exitCode: 1,
        stdout: 'MISSING:pandas,openpyxl\nRESOLVED_PATH:/mock/venv/bin/python\n',
        stderr: 'Some mock stderr output',
        timedOut: false,
        cancelled: false
      };
    };

    try {
      await childProcessRunner.runPreflight();
      assert.fail('Preflight should have failed');
    } catch (error) {
      assert.strictEqual(error.code, 'PREFLIGHT_FAILED', 'Error code should be PREFLIGHT_FAILED');
      assert.deepStrictEqual(error.details.missingPackages, ['pandas', 'openpyxl'], 'Should parse missing packages');
      assert.strictEqual(error.details.pythonExecutable, '/mock/venv/bin/python', 'Should parse resolved Python path');
      assert.strictEqual(error.details.recommendedCommand, '"/mock/venv/bin/python" -m pip install -r requirements-worker.txt', 'Should construct correct recommended command');
      assert.strictEqual(error.details.stderr, 'Some mock stderr output', 'Should preserve stderr');
    }

    // Test 7: Successful preflight behavior
    console.log('Scenario 7: Successful preflight behavior');
    resetMocks();
    childProcessRunner.runCommand = async () => {
      return {
        exitCode: 0,
        stdout: 'RESOLVED_PATH:/mock/venv/bin/python\n',
        stderr: '',
        timedOut: false,
        cancelled: false
      };
    };

    await childProcessRunner.runPreflight();

    // Test 8: Invalid configured executable behavior
    console.log('Scenario 8: Invalid configured executable behavior');
    resetMocks();
    process.env.PYTHON_EXECUTABLE = '/nonexistent/path/to/python';
    
    resolved = childProcessRunner.getPythonExecutable();
    assert.strictEqual(resolved, '/nonexistent/path/to/python', 'Resolver should return explicit path without fallback');

    childProcessRunner.runCommand = async ({ command }) => {
      assert.strictEqual(command, '/nonexistent/path/to/python');
      return {
        exitCode: null,
        stdout: '',
        stderr: 'spawn ENOENT',
        timedOut: false,
        cancelled: false
      };
    };

    try {
      await childProcessRunner.runPreflight();
      assert.fail('Should have failed due to invalid executable');
    } catch (error) {
      assert.strictEqual(error.code, 'PREFLIGHT_FAILED');
      assert.deepStrictEqual(error.details.missingPackages, ['pandas', 'openpyxl']);
      assert.strictEqual(error.details.pythonExecutable, '/nonexistent/path/to/python');
      assert.strictEqual(error.details.stderr, 'spawn ENOENT');
      assert.strictEqual(error.details.recommendedCommand, '"/nonexistent/path/to/python" -m pip install -r requirements-worker.txt');
    }

    // Test 9: Failed preflight blocks business execution
    console.log('Scenario 9: Failed preflight blocks business execution');
    resetMocks();

    let runCreatePrCdCalled = false;
    let recordedError = null;

    // Create job folder structure and file to avoid ENONET on readJobRequest
    const jobId = 'MOCK_BLOCK_JOB';
    await storageService.createJobFolders(jobId);
    const requestPath = storageService.resolveJobTempPath(jobId, 'job-request.json');
    await fsPromises.writeFile(requestPath, JSON.stringify({
      generationScope: 'all_sites',
      siteCodes: [],
      prScope: 'TSS'
    }), 'utf8');

    // Mock DB queries with custom thenables to bypass mongoose buffering
    Job.findOne = () => {
      const mockResult = {
        jobId: jobId,
        status: 'queued',
        prScope: 'TSS'
      };
      const promise = Promise.resolve(mockResult);
      promise.lean = () => Promise.resolve(mockResult);
      return promise;
    };

    Job.updateOne = async (filter, update) => {
      if (update.$set && update.$set.error) {
        recordedError = update.$set.error;
      }
    };

    JobFile.findOne = () => {
      const mockResult = {
        filePath: 'dummy.xlsx'
      };
      const sortPromise = {
        lean: () => Promise.resolve(mockResult)
      };
      const promise = {
        sort: () => sortPromise
      };
      return promise;
    };

    JobFile.create = async () => {};

    // Intercept low-level runCommand to simulate preflight check failure and track business execution calls
    childProcessRunner.runCommand = async ({ command, args }) => {
      if (args && args.includes('-c')) {
        // Preflight execution fails due to missing pandas
        return {
          exitCode: 1,
          stdout: 'MISSING:pandas\nRESOLVED_PATH:/mock/python/bin/python\n',
          stderr: 'ImportError: No module named pandas',
          timedOut: false,
          cancelled: false
        };
      }
      // Business execution call (should never be reached)
      runCreatePrCdCalled = true;
      return { exitCode: 0, stdout: '', stderr: '' };
    };

    await prWorkerService.runPrWorkerJob(jobId);

    assert.strictEqual(runCreatePrCdCalled, false, 'generate_tss_pr_ecc.py (runCreatePrCd) should not be invoked after preflight failure');
    assert.notStrictEqual(recordedError, null, 'An error should be persisted');
    assert.strictEqual(recordedError.code, 'PREFLIGHT_FAILED', 'Error code should be PREFLIGHT_FAILED');
    assert.deepStrictEqual(recordedError.details.missingPackages, ['pandas'], 'Should detail missing package(s)');
    assert.strictEqual(recordedError.details.pythonExecutable, '/mock/python/bin/python', 'Should persist resolved Python path');
    assert.strictEqual(recordedError.details.recommendedCommand, '"/mock/python/bin/python" -m pip install -r requirements-worker.txt', 'Should include recommended command');
    assert.strictEqual(recordedError.details.stderr, 'ImportError: No module named pandas', 'Should persist technical detail');

    // Clean up mock job folders
    await storageService.deleteFolderSafe(storageService.getJobRootPath(jobId));

    console.log('--- All Preflight and Python Resolution Unit Tests Passed! ---');
  } catch (err) {
    console.error('Test suite failed:', err);
    process.exit(1);
  } finally {
    resetMocks();
  }
};

runTests().then(() => {
  process.exit(0);
});
