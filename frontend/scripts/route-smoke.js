const assert = require('assert');
const { spawn } = require('child_process');

const routes = [
  '/',
  '/dashboard',
  '/workers/pr-creator',
  '/workers/pr-auditor',
  '/history',
  '/jobs/QA15-ROUTE-SMOKE',
  '/admin/login',
  '/admin/assets',
  '/admin/audit-logs',
  '/admin/health'
];

const waitForRoute = async (url, timeoutMs = 30000) => {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
};

const main = async () => {
  const port = 4173;
  const child = spawn(
    process.platform === 'win32'
      ? `npm run preview -- --host 127.0.0.1 --port ${port}`
      : 'npm',
    process.platform === 'win32'
      ? []
      : ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true
    }
  );

  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  child.stderr.on('data', (data) => {
    output += data.toString();
  });

  try {
    await waitForRoute(`http://127.0.0.1:${port}/`);

    const checked = [];
    for (const route of routes) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      assert(response.ok, `${route} should return HTTP 200`);
      const text = await response.text();
      assert(!text.includes('LLM_API_KEY'), `${route} should not expose LLM_API_KEY text`);
      checked.push(route);
    }

    console.log(JSON.stringify({ ok: true, routes: checked }));
  } finally {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
    } else {
      child.kill('SIGTERM');
    }
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
