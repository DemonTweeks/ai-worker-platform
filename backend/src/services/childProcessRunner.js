const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config/env');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const SCRIPT_RELATIVE_PATH = path.join('scripts', 'generate_tss_pr_ecc.py');
const SUPPORTED_SCOPES = ['TSS', 'TI'];
const WORKER_DEPENDENCIES = ['pandas', 'openpyxl'];

const getFallbackPythonExecutable = () => (process.platform === 'win32' ? 'python' : 'python3');
const getRepoRoot = () => path.resolve(config.repoRoot || path.resolve(__dirname, '../../..'));
const getConfiguredPythonExecutable = () => String(config.pythonExecutable || '').trim();
const getRepoVenvPythonExecutable = () => {
  const repoRoot = getRepoRoot();
  const candidates = process.platform === 'win32'
    ? [
        path.join(repoRoot, '.venv', 'Scripts', 'python.exe'),
        path.join(repoRoot, '.venv', 'bin', 'python')
      ]
    : [
        path.join(repoRoot, '.venv', 'bin', 'python'),
        path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
      ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
};

const getPythonExecutable = () => (
  getConfiguredPythonExecutable()
  || getRepoVenvPythonExecutable()
  || getFallbackPythonExecutable()
);

const getCreatePrCdRoot = () => path.resolve(config.createPrCdRoot);

const quoteCommand = (command) => (
  /\s/.test(String(command)) ? `"${String(command).replace(/"/g, '\\"')}"` : String(command)
);

const parseJsonOutput = (stdout) => {
  const raw = String(stdout || '').trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return null;
    }

    return JSON.parse(lines[lines.length - 1]);
  }
};

const buildCommand = ({
  siteDataPath,
  outputPath,
  generationScope,
  siteCodes,
  scope,
  pythonRuntime
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
    command: pythonRuntime.command,
    actualPythonExecutable: pythonRuntime.actualPythonExecutable || '',
    args,
    cwd: createPrCdRoot,
    scriptPath
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
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8'
    }
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

const probePythonRuntime = async ({ command, cwd, timeoutMs, isCancellationRequested }) => {
  const result = await runCommand({
    command,
    args: ['-c', 'import json, sys; print(json.dumps({"executable": sys.executable}))'],
    cwd,
    timeoutMs,
    isCancellationRequested
  });

  const payload = parseJsonOutput(result.stdout);
  if (result.exitCode !== 0 || !payload || !payload.executable) {
    const error = new Error('Unable to resolve the Python runtime for the PR Worker.');
    error.code = 'WORKER_PYTHON_UNAVAILABLE';
    error.details = {
      exitCode: result.exitCode,
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
      pythonExecutable: command
    };
    throw error;
  }

  return {
    command,
    actualPythonExecutable: String(payload.executable || '')
  };
};

const preflightWorkerDependencies = async ({
  command,
  cwd,
  timeoutMs,
  isCancellationRequested
}) => {
  const preflightScript = [
    'import importlib.util, json, sys',
    `packages = ${JSON.stringify(WORKER_DEPENDENCIES)}`,
    'missing = sorted([package for package in packages if importlib.util.find_spec(package) is None])',
    'print(json.dumps({"executable": sys.executable, "missingPackages": missing}))'
  ].join('; ');

  const result = await runCommand({
    command,
    args: ['-c', preflightScript],
    cwd,
    timeoutMs,
    isCancellationRequested
  });

  const payload = parseJsonOutput(result.stdout);
  if (result.exitCode !== 0 || !payload) {
    const error = new Error('Unable to verify Python worker dependencies before running create-pr-cd.');
    error.code = 'WORKER_DEPENDENCY_CHECK_FAILED';
    error.details = {
      exitCode: result.exitCode,
      stdout: result.stdout.slice(-2000),
      stderr: result.stderr.slice(-2000),
      pythonExecutable: command
    };
    throw error;
  }

  return {
    actualPythonExecutable: String(payload.executable || ''),
    missingPackages: Array.isArray(payload.missingPackages)
      ? payload.missingPackages.map((item) => String(item))
      : []
  };
};

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

    const createPrCdRoot = getCreatePrCdRoot();
    const pythonRuntime = await probePythonRuntime({
      command: getPythonExecutable(),
      cwd: createPrCdRoot,
      timeoutMs,
      isCancellationRequested
    });
    const dependencyCheck = await preflightWorkerDependencies({
      command: pythonRuntime.command,
      cwd: createPrCdRoot,
      timeoutMs,
      isCancellationRequested
    });

    if (dependencyCheck.missingPackages.length > 0) {
      const error = new Error(`Python worker dependency missing: ${dependencyCheck.missingPackages.join(', ')}.`);
      error.code = 'WORKER_DEPENDENCY_MISSING';
      error.details = {
        scope,
        missingPackages: dependencyCheck.missingPackages,
        pythonExecutable: pythonRuntime.command,
        actualPythonExecutable: dependencyCheck.actualPythonExecutable || pythonRuntime.actualPythonExecutable || '',
        recommendedFixCommand: `${quoteCommand(pythonRuntime.actualPythonExecutable || pythonRuntime.command)} -m pip install -r requirements-worker.txt`,
        workingDirectory: createPrCdRoot
      };
      throw error;
    }

    const commandSpec = buildCommand({
      siteDataPath: filteredInputPath,
      outputPath,
      generationScope,
      siteCodes,
      scope,
      pythonRuntime: {
        command: pythonRuntime.command,
        actualPythonExecutable: dependencyCheck.actualPythonExecutable || pythonRuntime.actualPythonExecutable || ''
      }
    });

    const result = await runCommand({
      ...commandSpec,
      timeoutMs,
      isCancellationRequested
    });

    runs.push({
      scope,
      command: commandSpec.command,
      actualPythonExecutable: commandSpec.actualPythonExecutable,
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
      error.details = {
        scope,
        exitCode: result.exitCode,
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        pythonExecutable: commandSpec.command,
        actualPythonExecutable: commandSpec.actualPythonExecutable,
        workingDirectory: commandSpec.cwd,
        resolvedSkillPath: commandSpec.scriptPath,
        outputPath
      };
      throw error;
    }

    if (result.exitCode !== 0) {
      const error = new Error(`create-pr-cd failed while running ${scope}.`);
      error.code = 'WORKER_PROCESS_FAILED';
      error.details = {
        scope,
        exitCode: result.exitCode,
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        pythonExecutable: commandSpec.command,
        actualPythonExecutable: commandSpec.actualPythonExecutable,
        workingDirectory: commandSpec.cwd,
        resolvedSkillPath: commandSpec.scriptPath,
        outputPath
      };
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
  WORKER_DEPENDENCIES,
  buildCommand,
  getCreatePrCdRoot,
  getPythonExecutable,
  runCommand,
  runCreatePrCd
};
