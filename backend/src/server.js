const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { checkFirebaseConnection } = require('./db/firebase');
const { ensureBaseStorage } = require('./services/storageService');
const { closeWebSocketServer, initWebSocketServer } = require('./websocket/server');

const server = http.createServer(app);
initWebSocketServer(server);

ensureBaseStorage()
  .then((status) => {
    console.log(`Storage initialized at ${status.root}`);
  })
  .catch((error) => {
    console.error(`Storage initialization failed: ${error.message}`);
  });

checkFirebaseConnection().then((res) => {
  if (res.connected) {
    console.log(`Firebase Realtime Database successfully reachable (Latency: ${res.latencyMs}ms)`);
  } else {
    console.error(`Firebase Realtime Database connection failed: ${res.error}`);
  }
});

server.listen(config.port, () => {
  console.log(`AI Worker Platform backend listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(async () => {
    await closeWebSocketServer();
    process.exit(0);
  });
});
