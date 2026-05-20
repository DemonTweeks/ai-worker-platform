const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');

process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ai_worker_platform_test';
process.env.LLM_ENABLED = process.env.LLM_ENABLED || 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-smoke-jwt-secret';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-smoke-admin-password';

const config = require('../src/config/env');
const app = require('../src/app');
const mongo = require('../src/db/mongo');
const jobRoutes = require('../src/routes/jobRoutes');
const adminRoutes = require('../src/routes/adminRoutes');
const healthRoutes = require('../src/routes/health');
const jobService = require('../src/services/jobService');
const jobQueue = require('../src/queue/jobQueue');
const prWorkerService = require('../src/services/prWorkerService');
const outputCollector = require('../src/services/outputCollector');
const reportGenerator = require('../src/services/reportGenerator');
const cleanupService = require('../src/services/cleanupService');
const healthService = require('../src/services/healthService');
const websocketServer = require('../src/websocket/server');
const llmClient = require('../src/llm/llmClient');
const { generateUniqueJobId } = require('../src/utils/jobIdGenerator');
const { parseSiteCodes } = require('../src/services/siteCodeParser');
const { sanitizeFileName, assertPathInsideRoot } = require('../src/utils/pathUtils');
const { generateAssetVersion } = require('../src/services/assetService');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  assert(config.port, 'config should load');
  assert(app, 'app import should load');
  assert(mongo, 'mongo module should load');
  assert(jobRoutes && adminRoutes && healthRoutes, 'route imports should load');
  assert(jobService && jobQueue && prWorkerService, 'job/queue/worker imports should load');
  assert(outputCollector && reportGenerator, 'output/report imports should load');
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

  const version = await generateAssetVersion('pr_model');
  assert(version.startsWith('PR_MODEL_'), 'asset version should include type prefix');

  const llmDisabled = await llmClient.generateText({
    task: 'qa_smoke',
    systemPrompt: 'Reply OK.',
    userPrompt: 'Reply OK.'
  });
  assert.strictEqual(llmDisabled.ok, false);
  assert.strictEqual(llmDisabled.code, 'LLM_DISABLED');

  console.log(JSON.stringify({
    ok: true,
    checks: [
      'config',
      'routes',
      'services',
      'job_id',
      'site_code_parser',
      'path_utils',
      'asset_version',
      'llm_disabled'
    ]
  }));
};

run().then(async () => {
  await mongoose.disconnect();
  process.exit(0);
}).catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
