const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const resolvePythonExecutable = () => {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const candidates = process.platform === 'win32'
    ? [
      ['python', ['-c', 'import os,sys; print(os.path.realpath(sys.executable))']],
      ['py', ['-3', '-c', 'import os,sys; print(os.path.realpath(sys.executable))']]
    ]
    : [
      ['python3', ['-c', 'import os,sys; print(os.path.realpath(sys.executable))']],
      ['python', ['-c', 'import os,sys; print(os.path.realpath(sys.executable))']]
    ];

  for (const [command, args] of candidates) {
    try {
      const resolved = String(execFileSync(command, args, {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8'
      }) || '').trim();

      if (path.isAbsolute(resolved) && fs.existsSync(resolved)) {
        process.env.PYTHON_EXECUTABLE = resolved;
        return resolved;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error('Unable to resolve an explicit Python interpreter path for RAN runtime tests.');
};

module.exports = {
  resolvePythonExecutable
};
