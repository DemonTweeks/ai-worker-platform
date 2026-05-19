const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue2');

module.exports = defineConfig({
  plugins: [vue()],
  server: {
    port: 3000
  }
});
