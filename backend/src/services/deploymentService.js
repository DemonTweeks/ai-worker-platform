const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createApiError } = require('../utils/apiError');

const SCRIPT_NAMES = ['stop-services.bat', 'launcher.bat'];
const scriptDirectory = path.resolve(
  process.env.DEPLOY_SCRIPT_DIRECTORY || 'C:\\deployment\\ai-worker-platform'
);

let handoffInProgress = false;

const resolveScripts = () => {
  console.info(`[DEPLOYMENT_PATH] directory=${scriptDirectory}`);

  return SCRIPT_NAMES.map((scriptName) => {
    const scriptPath = path.join(scriptDirectory, scriptName);
    const exists = fs.existsSync(scriptPath);
    console.info(`[DEPLOYMENT_PATH] script=${scriptName} path=${scriptPath} exists=${exists}`);

    if (!exists) {
      throw createApiError(500, 'DEPLOY_SCRIPT_NOT_FOUND', `${scriptName} was not found.`, {
        scriptDirectory,
        scriptPath,
        scriptName
      });
    }
    return scriptPath;
  });
};

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
  handoffInProgress = true;

  console.info(
    `[DEPLOYMENT_HANDOFF] stop=${stopScriptPath} launcher=${launcherScriptPath} startedAt=${startedAt}`
  );

  setImmediate(() => {
    const child = spawn(
      process.env.ComSpec || process.env.COMSPEC || 'cmd.exe',
      ['/d', '/s', '/c', `call "${stopScriptPath}" && call "${launcherScriptPath}"`],
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
    });
  });

  return {
    status: 'accepted',
    startedAt,
    message: 'Windows deployment scripts were handed off for background execution.'
  };
};

module.exports = {
  startDeployment
};
