const assert = require('assert');
const path = require('path');

process.env.FIREBASE_DB_MOCK = process.env.FIREBASE_DB_MOCK || 'true';
process.env.LLM_ENABLED = process.env.LLM_ENABLED || 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'qa-smoke-jwt-secret';
process.env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'qa-smoke-admin-password';

const config = require('../src/config/env');
const app = require('../src/app');
const firebase = require('../src/db/firebase');
const jobService = require('../src/services/jobService');
const jobQueue = require('../src/queue/jobQueue');
const genericSkillRunner = require('../src/skills/genericSkillRunner');
const skillPackageService = require('../src/skills/skillPackageService');
const cleanupService = require('../src/services/cleanupService');
const healthService = require('../src/services/healthService');
const websocketServer = require('../src/websocket/server');
const llmClient = require('../src/llm/llmClient');
const { Job } = require('../src/models');
const { generateUniqueJobId } = require('../src/utils/jobIdGenerator');
const { sanitizeFileName, assertPathInsideRoot } = require('../src/utils/pathUtils');

const run = async () => {
  assert((await firebase.checkFirebaseConnection()).connected);
  assert(config.port && app && jobService && jobQueue && genericSkillRunner && skillPackageService);
  assert(cleanupService && healthService && websocketServer && llmClient);
  assert.strictEqual(skillPackageService.listApprovedSkills().length, 3);

  const jobId = await generateUniqueJobId();
  assert(/^PR-\d{8}-\d{3}$/.test(jobId));
  assert.strictEqual(sanitizeFileName('valid.xlsx'), 'valid.xlsx');
  assert.throws(() => sanitizeFileName('../bad.xlsx'), /Unsafe file name/);
  assertPathInsideRoot(path.resolve('storage'), path.resolve('storage', 'temp', 'x.txt'));

  const llmDisabled = await llmClient.generateText({ task: 'qa_smoke', systemPrompt: 'Reply OK.', userPrompt: 'Reply OK.' });
  assert.strictEqual(llmDisabled.code, 'LLM_DISABLED');

  const queuedJob = await Job.create({
    jobId: `QA-SMOKE-QUEUED-${Date.now()}`,
    workerType: 'skill',
    workerId: 'create-pr-cd',
    skillId: 'create-pr-cd',
    status: 'queued'
  });
  assert.strictEqual(queuedJob.finalWorkerSummary, '');

  console.log(JSON.stringify({
    ok: true,
    checks: ['config', 'routes', 'generic_skills', 'job_id', 'path_utils', 'llm_disabled', 'queued_job_summary_empty', 'firebase_mock']
  }));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
