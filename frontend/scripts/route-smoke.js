const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const routes = [
  '/',
  '/dashboard',
  '/workers/pr-creator',
  '/workers/pr-auditor',
  '/workers/ran-pr-creator',
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
  const child = spawn(process.execPath, [
    path.resolve(__dirname, '../node_modules/vite/bin/vite.js'),
    'preview', '--host', '127.0.0.1', '--port', String(port)
  ], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true
  });

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
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('close', resolve);
      setTimeout(resolve, 3000);
    });
    child.stdout.destroy();
    child.stderr.destroy();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
