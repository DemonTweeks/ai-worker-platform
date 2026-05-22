const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue2');

module.exports = defineConfig({
  base: '/fe/',
  preview: {
    allowedHosts: true, 
  },
  plugins: [vue()],
  server: {
    port: 3000
  },
  test: {
    environment: 'jsdom'
  }
});
