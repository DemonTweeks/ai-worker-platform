const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');

const getPythonExecutable = () => {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  const virtualEnvironmentPython = process.platform === 'win32'
    ? path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(REPO_ROOT, '.venv', 'bin', 'python');
  if (fs.existsSync(virtualEnvironmentPython)) return virtualEnvironmentPython;
  return process.platform === 'win32' ? 'python' : 'python3';
};

module.exports = { getPythonExecutable };
