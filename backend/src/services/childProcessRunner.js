const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const config = require('../config/env');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const SCRIPT_RELATIVE_PATH = path.join('scripts', 'generate_tss_pr_ecc.py');
const SUPPORTED_SCOPES = ['TSS', 'TI'];

const getPythonExecutable = () => {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const repoRoot = path.resolve(__dirname, '../../..');

  if (process.platform === 'win32') {
    const winVenvPython = path.join(repoRoot, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(winVenvPython)) {
      return winVenvPython;
    }
    return 'python';
  } else {
    const nixVenvPython = path.join(repoRoot, '.venv', 'bin', 'python');
    if (fs.existsSync(nixVenvPython)) {
      return nixVenvPython;
    }
    return 'python3';
  }
};

const getExplicitPythonExecutable = () => {
  const configured = getPythonExecutable();

  if (path.isAbsolute(configured) && fs.existsSync(configured)) {
    return configured;
  }

  const repoRoot = path.resolve(__dirname, '../../..');
  const candidates = process.platform === 'win32'
    ? ['python.exe', 'python']
    : ['python3', 'python'];
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';

  for (const candidate of candidates) {
    try {
      const output = execFileSync(locator, [candidate], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8'
      });
      const resolved = String(output || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => path.isAbsolute(line) && fs.existsSync(line));

      if (resolved) {
        return resolved;
      }
    } catch (error) {
      continue;
    }
  }

  const error = new Error('A resolvable Python interpreter path is required for the RAN worker.');
  error.code = 'PYTHON_EXECUTABLE_NOT_RESOLVED';
  throw error;
};

const runPreflight = async () => {
  const pythonPath = getPythonExecutable();
  const checkCode = `
import sys
missing = []
try:
    import pandas
except ImportError:
    missing.append('pandas')
try:
    import openpyxl
except ImportError:
    missing.append('openpyxl')

if missing:
    print("MISSING:" + ",".join(missing))
print("RESOLVED_PATH:" + sys.executable)
if missing:
    sys.exit(1)
sys.exit(0)
`;

  const result = await module.exports.runCommand({
    command: pythonPath,
    args: ['-c', checkCode],
    cwd: path.resolve(__dirname, '../../..'),
    timeoutMs: 15000
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  let missingPackages = [];
  const missingMatch = stdout.match(/MISSING:(.+)/);
  if (missingMatch) {
    missingPackages = missingMatch[1].split(',').map(p => p.trim());
  }

  let resolvedPythonPath = pythonPath;
  const resolvedMatch = stdout.match(/RESOLVED_PATH:(.+)/);
  if (resolvedMatch) {
    resolvedPythonPath = resolvedMatch[1].trim();
  }

  if (result.exitCode !== 0 || missingPackages.length > 0) {
    if (missingPackages.length === 0) {
      missingPackages = ['pandas', 'openpyxl'];
    }
    const recCmd = `"${resolvedPythonPath}" -m pip install -r requirements-worker.txt`;
    const error = new Error(`Create PR worker preflight check failed due to missing dependencies: ${missingPackages.join(', ')}.`);
    error.code = 'PREFLIGHT_FAILED';
    error.details = {
      missingPackages,
      pythonExecutable: resolvedPythonPath,
      recommendedCommand: recCmd,
      stdout,
      stderr
    };
    throw error;
  }
};

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
    cwd: createPrCdRoot,
    scriptPath
  };
};

const runPythonStage = ({
  pythonExecutable,
  scriptPath,
  scriptArgs = [],
  cwd,
  env = {},
  timeoutMs,
  isCancellationRequested
}) => {
  if (!pythonExecutable || typeof pythonExecutable !== 'string') {
    throw new Error('pythonExecutable is required.');
  }

  if (!scriptPath || typeof scriptPath !== 'string') {
    throw new Error('scriptPath is required.');
  }

  if (path.basename(pythonExecutable).toLowerCase() === 'python' || pythonExecutable.toLowerCase() === 'python') {
    throw new Error('pythonExecutable must resolve to an explicit interpreter path.');
  }

  return module.exports.runCommand({
    command: pythonExecutable,
    args: [scriptPath, ...scriptArgs],
    cwd,
    timeoutMs,
    isCancellationRequested,
    env
  });
};

const runCommand = ({ command, args, cwd, timeoutMs, isCancellationRequested, env = {} }) => new Promise((resolve) => {
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
      ...env,
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

    const result = await module.exports.runCommand({
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
      error.details = {
        scope,
        exitCode: result.exitCode,
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
        pythonExecutable: commandSpec.command,
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
  buildCommand,
  getExplicitPythonExecutable,
  getCreatePrCdRoot,
  runCommand,
  runPythonStage,
  runCreatePrCd,
  getPythonExecutable,
  runPreflight
};
