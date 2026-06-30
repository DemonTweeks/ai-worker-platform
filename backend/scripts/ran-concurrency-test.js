const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';
require('./helpers/ensure-ran-python').resolvePythonExecutable();

const app = require('../src/app');
const { checkFirebaseConnection } = require('../src/db/firebase');
const { Job, JobFile, WarningItem, ReviewRequiredItem } = require('../src/models');
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');
const generalItemProject = 'CD consolidation 2023 (Swap/ Modernize)';
const terminalStatuses = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
const createdJobIds = new Set();
const submoduleRootsToProtect = [
  path.join(ranSkillRoot, 'input'),
  path.join(ranSkillRoot, 'output')
];
const browserTabSessionId = 'QA-RAN-CONCURRENCY-TAB';
let idempotencySequence = 0;
const nextIdempotencyKey = () => `ran-concurrency-${++idempotencySequence}`;

const request = async (baseUrl, route, options = {}) => {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
};

const uploadFile = async (baseUrl, route, filePath, extraFields = {}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }

  const buffer = await fs.promises.readFile(filePath);
  formData.append('file', new Blob([buffer]), path.basename(filePath));
  return request(baseUrl, route, { method: 'POST', body: formData });
};

const postJson = (baseUrl, route, body) => request(baseUrl, route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const snapshotDirectory = async (rootPath) => {
  const result = {};

  const walk = async (currentPath) => {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      const stats = await fs.promises.stat(absolutePath);
      const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, '/');
      result[relativePath] = {
        size: stats.size,
        mtimeMs: stats.mtimeMs
      };
    }
  };

  await walk(rootPath);
  return result;
};

const snapshotProtectedSubmoduleRoots = async () => {
  const snapshots = {};
  for (const rootPath of submoduleRootsToProtect) {
    snapshots[rootPath] = await snapshotDirectory(rootPath);
  }
  return snapshots;
};

const assertProtectedSubmoduleRootsUnchanged = async (beforeSnapshot) => {
  for (const rootPath of submoduleRootsToProtect) {
    const afterSnapshot = await snapshotDirectory(rootPath);
    assert.deepStrictEqual(
      afterSnapshot,
      beforeSnapshot[rootPath],
      `pinned RAN submodule path ${rootPath} must remain unchanged during runtime execution`
    );
  }
};

const createServer = async () => {
  const server = http.createServer(app);
  initWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
};

const closeServer = async (server) => {
  await closeWebSocketServer().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
};

const waitForCondition = async (predicate, timeoutMs, errorMessage) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await delay(500);
  }

  throw new Error(errorMessage);
};

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 300000) => waitForCondition(
  async () => {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should remain available for ${jobId}`);
    return terminalStatuses.has(result.body.job.status) ? result.body : null;
  },
  timeoutMs,
  `Timed out waiting for ${jobId} to reach a terminal state.`
);

const waitForPackagedDetail = async (baseUrl, jobId, timeoutMs = 300000) => waitForCondition(
  async () => {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should remain available for ${jobId}`);
    return result.body.outputs.some((file) => file.fileType === 'summary' && file.available)
      && result.body.outputs.some((file) => file.fileType === 'zip_package' && file.available)
      ? result.body
      : null;
  },
  timeoutMs,
  `Timed out waiting for ${jobId} packaged outputs.`
);

const createRanJob = async ({ baseUrl, runMode, selectedProject }) => {
  const bomPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleBomPath, {
    uploadKind: 'ran-bom'
  });
  assert.strictEqual(bomPrevalidation.response.status, 200, `${runMode} BOM prevalidation should pass`);

  const epmsPrevalidation = await uploadFile(baseUrl, '/api/jobs/prevalidate', sampleEpmsPath, {
    uploadKind: 'ran-epms'
  });
  assert.strictEqual(epmsPrevalidation.response.status, 200, `${runMode} EPMS prevalidation should pass`);

  const created = await postJson(baseUrl, '/api/jobs', {
    workerId: 'ran-pr',
    browserTabSessionId,
    idempotencyKey: nextIdempotencyKey(),
    bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
    epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
    runMode,
    selectedProject
  });
  assert.strictEqual(created.response.status, 201, `${runMode} job should be created`);

  const jobId = created.body.job.jobId;
  createdJobIds.add(jobId);
  return {
    jobId,
    queue: created.body.queue
  };
};

const verifyWorkspaceRoots = async (jobIds) => {
  const workspaceRoots = jobIds.map((jobId) => storageService.getRanWorkspacePath(jobId));
  assert.notStrictEqual(workspaceRoots[0], workspaceRoots[1], 'concurrent jobs must use distinct workspace roots');

  await waitForCondition(
    async () => workspaceRoots.every((workspaceRoot) => (
      fs.existsSync(workspaceRoot)
      && fs.existsSync(path.join(workspaceRoot, 'src', 'simple_normalize.py'))
      && fs.existsSync(path.join(workspaceRoot, 'config', 'MainConfig.xlsx'))
      && fs.existsSync(path.join(workspaceRoot, 'input', 'BOM.xlsx'))
      && fs.existsSync(path.join(workspaceRoot, 'input', 'EPMS.xlsx'))
    )),
    30000,
    'Timed out waiting for concurrent RAN workspace roots and staged assets to exist.'
  );

  for (const [index, workspaceRoot] of workspaceRoots.entries()) {
    const jobId = jobIds[index];
    assert(fs.existsSync(path.join(workspaceRoot, 'src', 'simple_normalize.py')), `workspace ${jobId} should copy approved src assets`);
    assert(fs.existsSync(path.join(workspaceRoot, 'config', 'MainConfig.xlsx')), `workspace ${jobId} should copy approved config assets`);
    assert(fs.existsSync(path.join(workspaceRoot, 'input', 'BOM.xlsx')), `workspace ${jobId} should stage BOM.xlsx`);
    assert(fs.existsSync(path.join(workspaceRoot, 'input', 'EPMS.xlsx')), `workspace ${jobId} should stage EPMS.xlsx`);
  }

  return workspaceRoots;
};

const verifyConcurrentQueueState = async (baseUrl, jobIds) => waitForCondition(
  async () => {
    const listResult = await request(baseUrl, `/api/jobs?workerId=ran-pr&limit=20&page=1`);
    assert.strictEqual(listResult.response.status, 200, 'job list should load while concurrency test is running');

    const details = await Promise.all(jobIds.map((jobId) => request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`)));
    details.forEach((detail, index) => {
      assert.strictEqual(detail.response.status, 200, `detail should load for ${jobIds[index]}`);
    });

    const activeDetails = details
      .map((detail) => detail.body.job)
      .filter((job) => ['validating', 'loading_assets', 'generating', 'exporting'].includes(job.status));

    return activeDetails.length === 2 ? details.map((detail) => detail.body) : null;
  },
  60000,
  'Timed out waiting for both RAN jobs to be active concurrently.'
);

const verifyRetainedOutputs = async (details) => {
  for (const detail of details) {
    assert.strictEqual(detail.job.status, 'completed', `job ${detail.job.jobId} should complete successfully`);
    assert(
      detail.outputs.some((file) => file.fileType === 'summary' && file.available),
      `job ${detail.job.jobId} should retain Summary.json`
    );
    assert(
      detail.outputs.some((file) => file.fileType === 'zip_package' && file.available),
      `job ${detail.job.jobId} should retain an available ZIP package`
    );
  }

  const outputFilePaths = await Promise.all(details.map(async (detail) => {
    const zip = await JobFile.findOne({ jobId: detail.job.jobId, fileType: 'zip_package' }).lean();
    assert(zip, `job ${detail.job.jobId} should persist a ZIP file record`);
    return zip.filePath;
  }));
  assert.notStrictEqual(outputFilePaths[0], outputFilePaths[1], 'concurrent jobs must retain outputs under distinct storage paths');
};

const cleanupArtifacts = async () => {
  for (const jobId of createdJobIds) {
    await Promise.all([
      Job.deleteMany({ jobId }),
      JobFile.deleteMany({ jobId }),
      WarningItem.deleteMany({ jobId }),
      ReviewRequiredItem.deleteMany({ jobId })
    ]).catch(() => {});
    await storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {});
    await storageService.deleteRanWorkspace(jobId).catch(() => {});
  }
};

const main = async () => {
  let serverInfo = null;
  let protectedSubmoduleSnapshot = null;

  try {
    const connection = await checkFirebaseConnection();
    assert(connection.connected, 'Firebase RTDB should be reachable for concurrency verification');
    await storageService.ensureBaseStorage();
    await storageService.ensureRanWorkspaceBase();
    protectedSubmoduleSnapshot = await snapshotProtectedSubmoduleRoots();

    serverInfo = await createServer();
    const standardJob = await createRanJob({
      baseUrl: serverInfo.baseUrl,
      runMode: 'standard-pr',
      selectedProject: null
    });
    const generalJob = await createRanJob({
      baseUrl: serverInfo.baseUrl,
      runMode: 'general-item',
      selectedProject: generalItemProject
    });

    const jobIds = [standardJob.jobId, generalJob.jobId];
    await verifyWorkspaceRoots(jobIds);
    await verifyConcurrentQueueState(serverInfo.baseUrl, jobIds);

    const terminalDetails = await Promise.all(jobIds.map((jobId) => waitForJobTerminal(serverInfo.baseUrl, jobId)));
    assert(terminalDetails.every((detail) => detail.job.status === 'completed'), 'concurrent jobs should still reach completed terminal states');
    const packagedDetails = await Promise.all(jobIds.map((jobId) => waitForPackagedDetail(serverInfo.baseUrl, jobId)));
    await verifyRetainedOutputs(packagedDetails);
    await assertProtectedSubmoduleRootsUnchanged(protectedSubmoduleSnapshot);

    console.log(JSON.stringify({
      ok: true,
      jobs: terminalDetails.map((detail) => ({
        jobId: detail.job.jobId,
        status: detail.job.status,
        runMode: detail.job.runMode,
        selectedProject: detail.job.selectedProject || null
      })),
      verified: [
        'distinct-workspace-roots',
        'concurrent-active-ran-jobs',
        'isolated-staged-inputs',
        'distinct-retained-output-paths',
        'submodule-input-output-unchanged'
      ]
    }, null, 2));
  } finally {
    if (serverInfo) {
      await closeServer(serverInfo.server).catch(() => {});
    }
    await cleanupArtifacts().catch(() => {});
  }
};

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
