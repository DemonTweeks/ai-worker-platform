const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const xlsx = require('xlsx');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform-test';
process.env.LLM_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-integration-jwt-secret';
process.env.ADMIN_DEFAULT_USERNAME = process.env.ADMIN_DEFAULT_USERNAME || 'qa-admin';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-admin-password';

const app = require('../src/app');
const { checkFirebaseConnection } = require('../src/db/firebase');
const { Job, JobFile, WarningItem, ReviewRequiredItem } = require('../src/models');
const storageService = require('../src/services/storageService');
const { initWebSocketServer, closeWebSocketServer } = require('../src/websocket/server');

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const sampleBomPath = path.join(ranSkillRoot, 'input', 'BOM.xlsx');
const sampleEpmsPath = path.join(ranSkillRoot, 'input', 'EPMS.xlsx');
const expectedStandardPath = path.join(ranSkillRoot, 'output', 'ECC_PR_Output.xlsx');
const expectedGeneralPath = path.join(ranSkillRoot, 'output', 'ECC_PR_Output_With_GeneralItems.xlsx');
const generalItemProject = 'CD consolidation 2023 (Swap/ Modernize)';
const terminalStatuses = new Set(['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result']);
const createdJobIds = new Set();

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

const waitForJobTerminal = async (baseUrl, jobId, timeoutMs = 300000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should load for ${jobId}`);

    if (terminalStatuses.has(result.body.job.status)) {
      return result.body;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${jobId} to reach a terminal state.`);
};

const waitForPackagedDetail = async (baseUrl, jobId, timeoutMs = 300000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await request(baseUrl, `/api/jobs/${encodeURIComponent(jobId)}`);
    assert.strictEqual(result.response.status, 200, `job detail should load for ${jobId}`);

    if (
      result.body.outputs.some((file) => file.fileType === 'summary' && file.available)
      && result.body.outputs.some((file) => file.fileType === 'zip_package' && file.available)
    ) {
      return result.body;
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${jobId} to expose packaged outputs.`);
};

const readLogicalWorkbook = (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: false, raw: false });
  const firstSheet = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    defval: '',
    raw: false
  });
  const header = (rows[0] || []).map((value) => String(value ?? '').trim());
  const dataRows = rows.slice(1).map((row) => header.map((key, index) => `${key}=${String(row[index] ?? '').trim()}`).join('|'));

  return {
    sheets: workbook.SheetNames,
    firstSheet,
    header,
    rowCount: dataRows.length,
    dataRows
  };
};

const summarizeLogicalWorkbook = (logicalWorkbook) => {
  const values = logicalWorkbook.dataRows.map((line) => Object.fromEntries(
    line.split('|').map((pair) => {
      const separatorIndex = pair.indexOf('=');
      return [pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)];
    })
  ));

  return {
    sheets: logicalWorkbook.sheets,
    rowCount: logicalWorkbook.rowCount,
    uniqueMaterials: new Set(values.map((row) => row['PBOM Code*'])).size,
    quantityTotal: values.reduce((sum, row) => sum + Number(row['Quantity*'] || 0), 0),
    generalItemRows: values.filter((row) => String(row.Remarks || '').includes('General')).length,
    firstDataRow: logicalWorkbook.dataRows[0],
    lastDataRow: logicalWorkbook.dataRows[logicalWorkbook.dataRows.length - 1]
  };
};

const compareLogicalWorkbook = ({ label, expectedPath, actualPath }) => {
  const expected = readLogicalWorkbook(expectedPath);
  const actual = readLogicalWorkbook(actualPath);

  const comparison = {
    label,
    expected: summarizeLogicalWorkbook(expected),
    actual: summarizeLogicalWorkbook(actual),
    headerMatch: JSON.stringify(expected.header) === JSON.stringify(actual.header),
    rowCountMatch: expected.rowCount === actual.rowCount,
    dataMatch: JSON.stringify(expected.dataRows) === JSON.stringify(actual.dataRows)
  };

  assert.strictEqual(comparison.headerMatch, true, `${label} workbook headers should match the pinned upstream reference`);
  assert.strictEqual(comparison.rowCountMatch, true, `${label} workbook row count should match the pinned upstream reference`);
  assert.strictEqual(comparison.dataMatch, true, `${label} workbook logical rows should match the pinned upstream reference`);

  return comparison;
};

const runGoldenJob = async ({ baseUrl, runMode, selectedProject }) => {
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
    bomPrevalidatedFileId: bomPrevalidation.body.prevalidatedFileId,
    epmsPrevalidatedFileId: epmsPrevalidation.body.prevalidatedFileId,
    runMode,
    selectedProject
  });
  assert.strictEqual(created.response.status, 201, `${runMode} job should be created`);

  const jobId = created.body.job.jobId;
  createdJobIds.add(jobId);
  const terminalDetail = await waitForJobTerminal(baseUrl, jobId);
  assert.strictEqual(terminalDetail.job.status, 'completed', `${runMode} job should complete successfully`);
  const detail = await waitForPackagedDetail(baseUrl, jobId);

  return {
    jobId,
    detail
  };
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
  }
};

const main = async () => {
  let serverInfo = null;

  try {
    const connection = await checkFirebaseConnection();
    assert(connection.connected, 'Firebase RTDB should be reachable for golden verification');
    await storageService.ensureBaseStorage();
    serverInfo = await createServer();

    const standard = await runGoldenJob({
      baseUrl: serverInfo.baseUrl,
      runMode: 'standard-pr',
      selectedProject: null
    });
    const general = await runGoldenJob({
      baseUrl: serverInfo.baseUrl,
      runMode: 'general-item',
      selectedProject: generalItemProject
    });

    const standardFile = await JobFile.findOne({ jobId: standard.jobId, fileType: 'ran_ecc_output' }).lean();
    const generalFile = await JobFile.findOne({ jobId: general.jobId, fileType: 'ran_ecc_output_with_general_items' }).lean();

    assert(standardFile, 'standard-pr golden run should retain ECC_PR_Output.xlsx');
    assert(generalFile, 'general-item golden run should retain ECC_PR_Output_With_GeneralItems.xlsx');

    const standardActualPath = path.join(storageService.getStorageRoot(), standardFile.filePath);
    const generalActualPath = path.join(storageService.getStorageRoot(), generalFile.filePath);

    const standardComparison = compareLogicalWorkbook({
      label: 'standard-pr',
      expectedPath: expectedStandardPath,
      actualPath: standardActualPath
    });
    const generalComparison = compareLogicalWorkbook({
      label: 'general-item',
      expectedPath: expectedGeneralPath,
      actualPath: generalActualPath
    });

    console.log(JSON.stringify({
      ok: true,
      project: generalItemProject,
      standard: {
        jobId: standard.jobId,
        comparison: standardComparison
      },
      general: {
        jobId: general.jobId,
        comparison: generalComparison
      }
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
