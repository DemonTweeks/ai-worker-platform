const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { connectMongo, disconnectMongo } = require('./db/mongo');
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

connectMongo();

server.listen(config.port, () => {
  console.log(`AI Worker Platform backend listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(async () => {
    await closeWebSocketServer();
    await disconnectMongo();
    process.exit(0);
  });
});
