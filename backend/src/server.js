const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { checkFirebaseConnection } = require('./db/firebase');
const { assertPlatformEngineIntegrity } = require('./services/engineIntegrityService');
const { ensureBaseStorage } = require('./services/storageService');
const { closeWebSocketServer, initWebSocketServer } = require('./websocket/server');
const { initializeQueue, shutdownQueue } = require('./queue/jobQueue');

let server = null;

const startServer = async () => {
  const integrityResults = assertPlatformEngineIntegrity();
  integrityResults.forEach((result) => {
    console.log(
      `Skill package integrity verified for ${result.workerId}`
      + `${result.packageVersion ? ` v${result.packageVersion}` : ''}`
      + ` (${result.runtimeFingerprint}).`
    );
  });

  server = http.createServer(app);
  initWebSocketServer(server);

  const storageStatus = await ensureBaseStorage();
  console.log(`Storage initialized at ${storageStatus.root}`);
  const firebaseStatus = await checkFirebaseConnection();
  if (!firebaseStatus.connected) {
    const error = new Error(`${config.dbProvider} database connection failed: ${firebaseStatus.error}`);
    error.code = 'DATABASE_STARTUP_UNAVAILABLE';
    throw error;
  }
  console.log(`${config.dbProvider} database successfully reachable (Latency: ${firebaseStatus.latencyMs}ms)`);
  const reconciliation = await initializeQueue();
  console.log(`Queue reconciliation completed for ${reconciliation.inspectedCount} non-terminal jobs.`);

  server.listen(config.port, config.host, () => {
    console.log(`AI Worker Platform backend listening on port ${config.port}`);
  });
};

process.on('SIGTERM', () => {
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    await shutdownQueue();
    await closeWebSocketServer();
    require('./db/databaseClient').close();
    process.exit(0);
  });
});

startServer().catch((error) => {
  console.error(`Backend startup failed [${error.code || 'STARTUP_ERROR'}]: ${error.message}`);
  process.exitCode = 1;
});

module.exports = {
  startServer
};
