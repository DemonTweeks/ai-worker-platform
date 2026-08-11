const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createApiError } = require('../utils/apiError');

const SCRIPT_NAMES = ['stop-services.bat', 'launcher.bat'];
const DEPLOYMENT_LOG_NAME = 'deployment-handoff.log';
const scriptDirectory = path.resolve(
  process.env.DEPLOY_SCRIPT_DIRECTORY || path.resolve(__dirname, '../../..')
);

let handoffInProgress = false;

const resolveScripts = () => SCRIPT_NAMES.map((scriptName) => {
  const scriptPath = path.join(scriptDirectory, scriptName);
  if (!fs.existsSync(scriptPath)) {
    throw createApiError(500, 'DEPLOY_SCRIPT_NOT_FOUND', `${scriptName} was not found.`, {
      scriptDirectory,
      scriptPath
    });
  }
  return scriptPath;
});

const startDeployment = () => {
  if (process.platform !== 'win32') {
    throw createApiError(
      501,
      'DEPLOYMENT_PLATFORM_UNSUPPORTED',
      'Deployment is supported only on Windows.'
    );
  }

  if (handoffInProgress) {
    throw createApiError(409, 'DEPLOYMENT_IN_PROGRESS', 'A deployment handoff is already in progress.');
  }

  const [stopScriptPath, launcherScriptPath] = resolveScripts();
  const startedAt = new Date().toISOString();
  const logPath = path.join(scriptDirectory, DEPLOYMENT_LOG_NAME);

  try {
    fs.appendFileSync(logPath, `[${startedAt}] Production deployment handoff requested.\r\n`, 'utf8');
  } catch (error) {
    throw createApiError(500, 'DEPLOYMENT_LOG_UNWRITABLE', 'Deployment log could not be written.', {
      logPath,
      reason: error.message
    });
  }

  handoffInProgress = true;

  setImmediate(() => {
    const handoffCommand = [
      `call "${stopScriptPath}" >> "${logPath}" 2>&1`,
      `call "${launcherScriptPath}" production >> "${logPath}" 2>&1`
    ].join(' && ');
    const child = spawn(
      process.env.ComSpec || process.env.COMSPEC || 'cmd.exe',
      ['/d', '/s', '/c', handoffCommand],
      {
        cwd: scriptDirectory,
        env: process.env,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }
    );

    child.once('spawn', () => {
      handoffInProgress = false;
      child.unref();
    });
    child.once('error', (error) => {
      handoffInProgress = false;
      console.error(`DEPLOYMENT_HANDOFF_FAILED: ${error.message}`);
      try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${error.message}\r\n`, 'utf8');
      } catch (logError) {
        console.error(`DEPLOYMENT_LOG_WRITE_FAILED: ${logError.message}`);
      }
    });
  });

  return {
    status: 'accepted',
    startedAt,
    logPath,
    message: 'Windows deployment scripts were handed off for background execution.'
  };
};

module.exports = {
  startDeployment
};
