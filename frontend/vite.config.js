const path = require('path');
const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue2');
const dotenv = require('dotenv');

module.exports = defineConfig(() => {
  const runtimeProfile = String(process.env.AI_WORKER_PROFILE || 'local').toLowerCase();
  if (!['local', 'production'].includes(runtimeProfile)) {
    throw new Error(`Unsupported AI_WORKER_PROFILE: ${runtimeProfile}`);
  }

  const envDirectory = path.resolve(__dirname, '../config/env');
  dotenv.config({
    path: path.join(envDirectory, `${runtimeProfile}.env`),
    quiet: true
  });

  process.env.VITE_APP_BASE ??= runtimeProfile === 'production' ? '/fe/' : '/';
  process.env.VITE_ROUTER_MODE ??= runtimeProfile === 'production' ? 'hash' : 'history';
  process.env.VITE_API_BASE_URL ??= runtimeProfile === 'production' ? '' : 'http://127.0.0.1:8000';
  process.env.VITE_WS_URL ??= runtimeProfile === 'production' ? '' : 'ws://127.0.0.1:8000/ws';

  return {
    base: process.env.VITE_APP_BASE,
    envDir: false,
    plugins: [vue()],
    server: {
      port: 3000
    },
    preview: {
      host: '127.0.0.1',
      port: 3000,
      allowedHosts: true
    },
    test: {
      environment: 'jsdom'
    }
  };
});
