const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { checkFirebaseConnection } = require('./db/firebase');
const { assertPlatformEngineIntegrity } = require('./services/engineIntegrityService');
const { ensureBaseStorage } = require('./services/storageService');
const { closeWebSocketServer, initWebSocketServer } = require('./websocket/server');

let server = null;

const startServer = () => {
  const integrityResults = assertPlatformEngineIntegrity();
  integrityResults.forEach((result) => {
    console.log(
      `Engine integrity verified for ${result.workerId} at ${result.engineCommit}`
      + `${result.gitCommitVerified ? ' (Git + runtime fingerprint).' : ' (runtime fingerprint).'}`
    );
  });

  server = http.createServer(app);
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
};

process.on('SIGTERM', () => {
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    await closeWebSocketServer();
    process.exit(0);
  });
});

try {
  startServer();
} catch (error) {
  console.error(`Engine integrity verification failed [${error.code || 'ENGINE_INTEGRITY_ERROR'}]: ${error.message}`);
  process.exitCode = 1;
}

module.exports = {
  startServer
};
