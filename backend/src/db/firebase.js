const { readFirebase, writeFirebase } = require('./firebaseClient');

const connectionState = {
  status: 'disconnected',
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null
};

const checkFirebaseConnection = async () => {
  try {
    const start = Date.now();
    // Test endpoint reachability with a fast test node (e.g. read/write a timestamp to a health check path)
    const timestamp = new Date().toISOString();
    await writeFirebase('health', { lastPingAt: timestamp });
    
    connectionState.status = 'connected';
    connectionState.lastConnectedAt = timestamp;
    connectionState.lastError = null;
    
    return {
      connected: true,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    connectionState.status = 'disconnected';
    connectionState.lastDisconnectedAt = new Date().toISOString();
    connectionState.lastError = error.message;
    return {
      connected: false,
      error: error.message
    };
  }
};

const getFirebaseStatus = () => ({
  status: connectionState.status,
  connected: connectionState.status === 'connected',
  lastConnectedAt: connectionState.lastConnectedAt,
  lastDisconnectedAt: connectionState.lastDisconnectedAt,
  lastError: connectionState.lastError
});

module.exports = {
  checkFirebaseConnection,
  getFirebaseStatus
};
