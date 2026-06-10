const assert = require('assert');
const path = require('path');

process.env.FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform';
process.env.LLM_ENABLED = process.env.LLM_ENABLED || 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-smoke-jwt-secret';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-smoke-admin-password';

const config = require('../src/config/env');
const app = require('../src/app');
const firebase = require('../src/db/firebase');
const jobRoutes = require('../src/routes/jobRoutes');
const adminRoutes = require('../src/routes/adminRoutes');
const healthRoutes = require('../src/routes/health');
const jobService = require('../src/services/jobService');
const jobQueue = require('../src/queue/jobQueue');
const prWorkerService = require('../src/services/prWorkerService');
const { Job } = require('../src/models');
const { saveFinalSummary } = require('../src/services/finalSummaryService');
const outputCollector = require('../src/services/outputCollector');
const tiResultIngestionService = require('../src/services/tiResultIngestionService');
const zeroOutputPolicyService = require('../src/services/zeroOutputPolicyService');
const reportGenerator = require('../src/services/reportGenerator');
const cleanupService = require('../src/services/cleanupService');
const healthService = require('../src/services/healthService');
const websocketServer = require('../src/websocket/server');
const llmClient = require('../src/llm/llmClient');
const { generateUniqueJobId } = require('../src/utils/jobIdGenerator');
const { parseSiteCodes } = require('../src/services/siteCodeParser');
const { sanitizeFileName, assertPathInsideRoot } = require('../src/utils/pathUtils');

const run = async () => {
  const conn = await firebase.checkFirebaseConnection();
  assert(conn.connected, 'Firebase RTDB should be reachable');
  
  assert(config.port, 'config should load');
  assert(app, 'app import should load');
  assert(firebase, 'firebase module should load');
  assert(jobRoutes && adminRoutes && healthRoutes, 'route imports should load');
  assert(jobService && jobQueue && prWorkerService, 'job/queue/worker imports should load');
  assert(outputCollector && reportGenerator, 'output/report imports should load');
  assert(tiResultIngestionService && zeroOutputPolicyService, 'TI result ingestion/policy imports should load');
  assert(cleanupService && healthService, 'cleanup/health imports should load');
  assert(websocketServer && llmClient, 'websocket/llm imports should load');

  const jobId = await generateUniqueJobId();
  assert(/^PR-\d{8}-\d{3}$/.test(jobId), 'job id format should match PR-YYYYMMDD-NNN');

  const parsedSites = parseSiteCodes(['abc001', 'ABC001', ' def002 ']);
  assert.deepStrictEqual(parsedSites.siteCodes, ['ABC001', 'DEF002']);
  assert.deepStrictEqual(parsedSites.duplicateSiteCodes, ['ABC001']);

  assert.strictEqual(sanitizeFileName('valid.xlsx'), 'valid.xlsx');
  assert.throws(() => sanitizeFileName('../bad.xlsx'), /Unsafe file name/);
  assertPathInsideRoot(path.resolve('storage'), path.resolve('storage', 'temp', 'x.txt'));

  const llmDisabled = await llmClient.generateText({
    task: 'qa_smoke',
    systemPrompt: 'Reply OK.',
    userPrompt: 'Reply OK.'
  });
  assert.strictEqual(llmDisabled.ok, false);
  assert.strictEqual(llmDisabled.code, 'LLM_DISABLED');
  assert.strictEqual(zeroOutputPolicyService.determineFinalStatus({
    matchedSiteCount: 1,
    outputFileCount: 0,
    reviewRequiredCount: 1,
    warningCount: 0
  }), 'completed_with_warning');
  assert.throws(() => zeroOutputPolicyService.determineFinalStatus({
    matchedSiteCount: 1,
    outputFileCount: 0,
    reviewRequiredCount: 0,
    warningCount: 0
  }), /No ECC files were generated/);

  const obsoleteQueueSummary = 'Job created and queued. PR Worker execution will run after the worker queue layer is implemented.';
  const queuedJobId = `QA-SMOKE-QUEUED-${Date.now()}`;
  const queuedJob = await Job.create({
    jobId: queuedJobId,
    workerType: 'pr-worker',
    status: 'queued',
    generationScope: 'site_code',
    prScope: 'TSS'
  });
  assert.strictEqual(queuedJob.finalWorkerSummary, '', 'queued jobs should not start with final worker summary');
  assert.notStrictEqual(queuedJob.finalWorkerSummary, obsoleteQueueSummary, 'queued jobs should not use obsolete queue summary');

  const completedJobId = `QA-SMOKE-COMPLETED-${Date.now()}`;
  await Job.create({
    jobId: completedJobId,
    workerType: 'pr-worker',
    status: 'completed',
    generationScope: 'site_code',
    prScope: 'TSS'
  });
  const finalWorkerSummary = await saveFinalSummary({
    jobId: completedJobId,
    summary: {
      requestedSiteCount: 1,
      matchedSiteCount: 1,
      unmatchedSiteCount: 0,
      outputFileCount: 1,
      reviewRequiredCount: 0,
      warningCount: 0
    }
  });
  assert(finalWorkerSummary.includes('Task completed.'), 'completed jobs should receive terminal final summary');
  assert.notStrictEqual(finalWorkerSummary, obsoleteQueueSummary, 'completed final summary should not use obsolete queue summary');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'config',
      'routes',
      'services',
      'job_id',
      'site_code_parser',
      'path_utils',
      'admin_asset_routes',
      'llm_disabled',
      'zero_output_policy',
      'queued_job_summary_empty',
      'completed_job_final_summary',
      'firebase_db_connected'
    ]
  }));
};

run().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
