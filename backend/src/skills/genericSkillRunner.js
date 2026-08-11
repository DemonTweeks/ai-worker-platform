const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config/env');
const { Job, JobFile, WarningItem } = require('../models');
const storageService = require('../services/storageService');
const workerStateService = require('../services/workerStateService');
const { getPythonExecutable } = require('../services/childProcessRunner');
const { publishHeartbeat, publishJobEvent, JOB_EVENTS } = require('../websocket/eventPublisher');
const { assertPathInsideRoot, toStorageRelativePath } = require('../utils/pathUtils');
const { loadApprovedSkill } = require('./skillPackageService');

const RESULT_STATUSES = new Set(['succeeded', 'succeeded_with_warning', 'failed', 'cancelled']);

const sha256File = async (filePath) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
};

const safeResultPath = (workspace, relativePath, label) => {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`${label} must be workspace-relative.`);
  return assertPathInsideRoot(workspace, path.resolve(workspace, relativePath));
};

const validateReconciliation = (reconciliation, status) => {
  if (reconciliation === undefined) return;
  const fields = [
    'requestedCount', 'generatedCount', 'reviewRequiredCount', 'approvedIgnoredCount',
    'duplicateBlockedCount', 'failedCount', 'unaccountedCount'
  ];
  for (const field of fields) {
    if (!Number.isInteger(reconciliation[field]) || reconciliation[field] < 0) {
      throw new Error(`result.reconciliation.${field} must be a non-negative integer.`);
    }
  }
  const accounted = fields.slice(1).reduce((sum, field) => sum + reconciliation[field], 0);
  if (accounted !== reconciliation.requestedCount) throw new Error('result.reconciliation arithmetic is inconsistent.');
  const warningDispositions = reconciliation.reviewRequiredCount + reconciliation.approvedIgnoredCount
    + reconciliation.duplicateBlockedCount + reconciliation.failedCount + reconciliation.unaccountedCount;
  if (status === 'succeeded' && warningDispositions > 0) throw new Error('A clean success cannot contain warning dispositions.');
  if (['succeeded', 'succeeded_with_warning'].includes(status) && reconciliation.unaccountedCount > 0) {
    throw new Error('A successful result cannot contain unaccounted work.');
  }
};

const validateResult = async ({ result, job, skill, workspace }) => {
  if (!result || result.schemaVersion !== '1.0') throw new Error('result.json schemaVersion must be 1.0.');
  if (result.jobId !== job.jobId || result.skillId !== skill.manifest.skillId || result.skillVersion !== skill.manifest.version) {
    throw new Error('result.json identity does not match the invocation.');
  }
  if (!RESULT_STATUSES.has(result.status)) throw new Error('result.json status is unsupported.');
  if (!Array.isArray(result.outputs) || !Array.isArray(result.warnings)) throw new Error('result.json outputs and warnings must be arrays.');
  validateReconciliation(result.reconciliation, result.status);
  const outputs = [];
  for (const [index, item] of result.outputs.entries()) {
    const absolutePath = safeResultPath(workspace, item.path, `result.outputs[${index}].path`);
    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile()) throw new Error(`Declared output is not a file: ${item.path}`);
    const actualSha256 = await sha256File(absolutePath);
    if (item.sha256 && String(item.sha256).toLowerCase() !== actualSha256) throw new Error(`Declared output checksum mismatch: ${item.path}`);
    outputs.push({ ...item, absolutePath, fileSize: stats.size, sha256: actualSha256 });
  }
  return { result, outputs };
};

const parseProgressLine = async (jobId, line) => {
  let event;
  try { event = JSON.parse(line); } catch (_error) { return; }
  if (!event || !['progress', 'warning', 'log'].includes(event.type)) return;
  const phase = String(event.phase || 'skill_processing').slice(0, 120);
  const message = String(event.message || '').slice(0, 500);
  const percent = Number(event.percent);
  workerStateService.setPhase(jobId, phase, message || phase);
  if (Number.isFinite(percent)) {
    workerStateService.setProgress(jobId, { processedRows: Math.max(0, Math.min(100, percent)), totalRows: 100, message });
  }
  await publishHeartbeat(jobId);
};

const executeProcess = ({ jobId, skill, inputManifest, workspace, cancellationPath }) => new Promise((resolve) => {
  const child = childProcess.spawn(getPythonExecutable(), [skill.entrypoint, '--input-manifest', inputManifest], {
    cwd: workspace,
    shell: false,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
  });
  const stderr = [];
  let timedOut = false;
  let cancellationSent = false;
  let forceKillTimer = null;
  const requestStop = async (cancelled) => {
    if (cancellationSent) return;
    cancellationSent = true;
    if (cancelled) {
      await fs.promises.mkdir(path.dirname(cancellationPath), { recursive: true });
      await fs.promises.writeFile(cancellationPath, 'cancel\n', 'utf8');
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGTERM');
          forceKillTimer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
        }
      }, 3000);
      return;
    }
    child.kill('SIGTERM');
    forceKillTimer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
  };
  const stdoutReader = readline.createInterface({ input: child.stdout });
  stdoutReader.on('line', (line) => { parseProgressLine(jobId, line).catch(() => {}); });
  child.stderr.on('data', (chunk) => {
    stderr.push(chunk.toString());
    if (stderr.join('').length > 8000) stderr.splice(0, stderr.length - 1);
  });
  const cancellationPoll = setInterval(() => {
    if (workerStateService.isCancellationRequested(jobId)) requestStop(true).catch(() => {});
  }, 250);
  const timeout = setTimeout(() => { timedOut = true; requestStop(false).catch(() => {}); }, skill.manifest.execution.timeoutSeconds * 1000);
  child.on('error', (error) => stderr.push(error.message));
  child.on('close', (exitCode) => {
    clearInterval(cancellationPoll);
    clearTimeout(timeout);
    if (forceKillTimer) clearTimeout(forceKillTimer);
    stdoutReader.close();
    resolve({ exitCode, timedOut, cancelled: cancellationSent && !timedOut, stderr: stderr.join('').slice(-4000) });
  });
});

const persistResult = async ({ job, result, outputs, skill }) => {
  const createdFiles = await JobFile.insertMany(outputs.map((item) => ({
    jobId: job.jobId,
    fileType: 'skill_output',
    fileName: item.displayName || path.basename(item.absolutePath),
    filePath: toStorageRelativePath(storageService.getStorageRoot(), item.absolutePath),
    fileSize: item.fileSize,
    mediaType: item.mediaType || 'application/octet-stream',
    sha256: item.sha256,
    retentionUntil: new Date(Date.now() + config.limits.fileRetentionDays * 86400000).toISOString()
  })));
  if (result.warnings.length) {
    await WarningItem.insertMany(result.warnings.map((warning) => ({
      jobId: job.jobId,
      code: String(warning.code || 'SKILL_WARNING').slice(0, 120),
      message: String(warning.message || 'Skill warning.').slice(0, 1000),
      details: warning.details && typeof warning.details === 'object' ? warning.details : {}
    })));
  }
  const statusMap = {
    succeeded: 'completed',
    succeeded_with_warning: 'completed_with_warning',
    failed: 'failed',
    cancelled: outputs.length ? 'cancelled_with_partial_result' : 'cancelled'
  };
  job.status = statusMap[result.status];
  job.completedAt = new Date().toISOString();
  if (result.status === 'cancelled') job.cancelledAt = job.completedAt;
  job.outputFileCount = createdFiles.length;
  job.warningCount = result.warnings.length;
  job.finalWorkerSummary = String(result.summary && result.summary.message || 'Skill execution completed.').slice(0, 1000);
  job.skill = {
    skillId: skill.manifest.skillId,
    version: skill.manifest.version,
    contractVersion: skill.manifest.resultContractVersion,
    packageSha256: skill.packageSha256
  };
  job.skillResult = result;
  if (result.reconciliation) {
    job.requestedSiteCount = result.reconciliation.requestedCount;
    job.generatedSiteCount = result.reconciliation.generatedCount;
    job.reviewRequiredSiteCount = result.reconciliation.reviewRequiredCount;
    job.approvedIgnoredSiteCount = result.reconciliation.approvedIgnoredCount;
    job.duplicateBlockedSiteCount = result.reconciliation.duplicateBlockedCount;
    job.failedSiteCount = result.reconciliation.failedCount;
    job.unaccountedSiteCount = result.reconciliation.unaccountedCount;
    job.accountedSiteCount = result.reconciliation.requestedCount - result.reconciliation.unaccountedCount;
    job.reconciliationConsistent = true;
  }
  if (result.error) job.error = result.error;
  await job.save();
  return createdFiles;
};

const failJob = async (job, error) => {
  job.status = 'failed';
  job.completedAt = new Date().toISOString();
  job.finalWorkerSummary = 'The skill did not return a valid result.';
  job.error = {
    code: error.code || 'RESULT_CONTRACT_INVALID',
    category: 'internal',
    message: 'The skill did not return a valid result.',
    retryable: false,
    details: {}
  };
  await job.save();
  workerStateService.setError(job.jobId, job.error);
  await publishJobEvent(job.jobId, JOB_EVENTS.JOB_FAILED, { phase: 'FAILED', status: 'failed', message: job.finalWorkerSummary });
};

const runGenericSkillJob = async (jobId) => {
  const job = await Job.findOne({ jobId });
  if (!job) throw new Error(`Job ${jobId} was not found.`);
  const skill = loadApprovedSkill(job.skillId || job.workerId);
  const workspace = storageService.getJobRootPath(jobId);
  const inputManifest = assertPathInsideRoot(workspace, path.join(workspace, 'skill-input.json'));
  const cancellationPath = storageService.resolveJobTempPath(jobId, 'cancel.requested');
  const resultPath = assertPathInsideRoot(workspace, path.join(workspace, 'result.json'));
  job.status = 'generating';
  job.startedAt = job.startedAt || new Date().toISOString();
  await job.save();
  workerStateService.getOrCreateState(jobId);
  workerStateService.setPhase(jobId, 'skill_starting', 'Starting approved skill package.');
  await publishJobEvent(jobId, JOB_EVENTS.GENERATION_STARTED, { phase: 'skill_starting', status: 'generating', message: 'Starting approved skill package.' });
  try {
    const processResult = await executeProcess({ jobId, skill, inputManifest, workspace, cancellationPath });
    if (processResult.timedOut && !fs.existsSync(resultPath)) {
      const error = new Error('Skill execution timed out.');
      error.code = 'WORKER_TIMEOUT';
      throw error;
    }
    if (!fs.existsSync(resultPath)) {
      const error = new Error('Skill did not write result.json.');
      error.code = 'RESULT_CONTRACT_INVALID';
      throw error;
    }
    const result = JSON.parse(await fs.promises.readFile(resultPath, 'utf8'));
    const validated = await validateResult({ result, job, skill, workspace });
    await persistResult({ job, ...validated, skill });
    if (['cancelled', 'cancelled_with_partial_result'].includes(job.status)) {
      workerStateService.setCancelled(jobId, job.finalWorkerSummary);
      await publishJobEvent(jobId, JOB_EVENTS.JOB_CANCELLED, { phase: 'CANCELLED', status: job.status, message: job.finalWorkerSummary });
    } else if (job.status === 'failed') {
      workerStateService.setError(jobId, result.error || {});
      await publishJobEvent(jobId, JOB_EVENTS.JOB_FAILED, { phase: 'FAILED', status: 'failed', message: job.finalWorkerSummary });
    } else {
      workerStateService.setComplete(jobId, job.finalWorkerSummary);
      await publishJobEvent(jobId, JOB_EVENTS.JOB_COMPLETED, { phase: 'COMPLETED', status: job.status, message: job.finalWorkerSummary });
    }
    return { job, result, processResult };
  } catch (error) {
    console.error(`Generic skill ${job.skillId || job.workerId} failed for ${jobId}: ${error.message}`);
    await failJob(job, error);
    return { job, error };
  }
};

module.exports = {
  executeProcess,
  runGenericSkillJob,
  validateReconciliation,
  validateResult
};
