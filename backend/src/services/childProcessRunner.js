const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config/env');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const SCRIPT_RELATIVE_PATH = path.join('scripts', 'generate_tss_pr_ecc.py');
const SUPPORTED_SCOPES = ['TSS', 'TI'];

const getPythonExecutable = () => (process.platform === 'win32' ? 'python' : 'python3');

const getCreatePrCdRoot = () => path.resolve(config.createPrCdRoot);

const buildCommand = ({
  siteDataPath,
  outputPath,
  generationScope,
  siteCodes,
  scope
}) => {
  const createPrCdRoot = getCreatePrCdRoot();
  const scriptPath = assertPathInsideRoot(createPrCdRoot, path.join(createPrCdRoot, SCRIPT_RELATIVE_PATH));

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`create-pr-cd script not found: ${scriptPath}`);
  }

  const args = [
    scriptPath,
    '--site-data', siteDataPath,
    '--output', outputPath,
    '--scope', scope
  ];

  if (generationScope === 'all_sites') {
    args.push('--all-sites');
  } else {
    args.push('--site-code', siteCodes.join(','));
  }

  return {
    command: getPythonExecutable(),
    args,
    cwd: createPrCdRoot
  };
};

const runCommand = ({ command, args, cwd, timeoutMs, isCancellationRequested }) => new Promise((resolve) => {
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let cancelled = false;
  let killTimer = null;

  const child = spawn(command, args, {
    cwd,
    shell: false,
    windowsHide: true
  });

  const stopChild = () => {
    if (killTimer) {
      return;
    }
    child.kill('SIGTERM');
    killTimer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 5000);
  };

  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      stopChild();
    }, timeoutMs)
    : null;

  const cancellationPoll = setInterval(() => {
    if (isCancellationRequested && isCancellationRequested()) {
      cancelled = true;
      stopChild();
    }
  }, 500);

  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', (error) => {
    stderr += error.message;
  });

  child.on('close', (exitCode) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (killTimer) {
      clearTimeout(killTimer);
    }
    clearInterval(cancellationPoll);
    resolve({
      exitCode,
      stdout,
      stderr,
      timedOut,
      cancelled
    });
  });
});

const runCreatePrCd = async ({
  jobId,
  filteredInputPath,
  generationScope,
  siteCodes,
  prScope,
  isCancellationRequested
}) => {
  const outputPath = storageService.resolveJobFolderPath(jobId, 'output');
  const timeoutMs = config.limits.jobTimeoutMinutes * 60 * 1000;
  const runs = [];
  const selectedScope = String(prScope || 'TSS').trim().toUpperCase();

  if (!SUPPORTED_SCOPES.includes(selectedScope)) {
    const error = new Error('PR Worker scope must be TSS or TI.');
    error.code = 'INVALID_PR_SCOPE';
    error.details = { prScope: selectedScope };
    throw error;
  }

  for (const scope of [selectedScope]) {
    if (isCancellationRequested && isCancellationRequested()) {
      return {
        cancelled: true,
        runs
      };
    }

    const commandSpec = buildCommand({
      siteDataPath: filteredInputPath,
      outputPath,
      generationScope,
      siteCodes,
      scope
    });

    const result = await runCommand({
      ...commandSpec,
      timeoutMs,
      isCancellationRequested
    });

    runs.push({
      scope,
      command: commandSpec.command,
      args: commandSpec.args.map((arg) => String(arg)),
      cwd: commandSpec.cwd,
      ...result
    });

    if (result.cancelled) {
      return {
        cancelled: true,
        runs
      };
    }

    if (result.timedOut) {
      const error = new Error(`create-pr-cd timed out while running ${scope}.`);
      error.code = 'WORKER_TIMEOUT';
      error.details = { scope, stdout: result.stdout.slice(-2000), stderr: result.stderr.slice(-2000) };
      throw error;
    }

    if (result.exitCode !== 0) {
      const error = new Error(`create-pr-cd failed while running ${scope}.`);
      error.code = 'WORKER_PROCESS_FAILED';
      error.details = { scope, exitCode: result.exitCode, stdout: result.stdout.slice(-2000), stderr: result.stderr.slice(-2000) };
      throw error;
    }
  }

  return {
    cancelled: false,
    runs
  };
};

module.exports = {
  SUPPORTED_SCOPES,
  buildCommand,
  getCreatePrCdRoot,
  runCommand,
  runCreatePrCd
};
