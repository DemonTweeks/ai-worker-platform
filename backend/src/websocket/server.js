const { WebSocketServer } = require('ws');
const config = require('../config/env');
const subscriptionManager = require('./subscriptionManager');
const { buildJobStateSnapshot } = require('./eventPublisher');
const { MESSAGE_TYPES } = require('./messageTypes');
const { startHeartbeatPublisher, stopHeartbeatPublisher } = require('./heartbeatPublisher');

let webSocketServer = null;

const sendError = (client, code, message, details = {}) => {
  subscriptionManager.sendJson(client, {
    type: MESSAGE_TYPES.ERROR,
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  });
};

const normalizeJobId = (jobId) => String(jobId || '').trim().toUpperCase();

const isValidJobId = (jobId) => /^PR-\d{8}-\d{3,}$/.test(jobId) || /^PR-[A-Z0-9-]+$/.test(jobId);

const handleSubscribe = async (client, rawJobId) => {
  const jobId = normalizeJobId(rawJobId);

  if (!jobId) {
    sendError(client, 'VALIDATION_ERROR', 'jobId is required.');
    return;
  }

  if (!isValidJobId(jobId)) {
    sendError(client, 'VALIDATION_ERROR', 'jobId format is invalid.');
    return;
  }

  const job = await subscriptionManager.subscribeClientToJob(client, jobId);

  if (!job) {
    sendError(client, 'JOB_NOT_FOUND', 'Job was not found.');
    return;
  }

  const snapshot = await buildJobStateSnapshot(jobId, job);

  subscriptionManager.sendJson(client, {
    type: MESSAGE_TYPES.SUBSCRIBED,
    jobId,
    timestamp: new Date().toISOString(),
    state: snapshot
  });
};

const handleUnsubscribe = (client, rawJobId) => {
  const jobId = normalizeJobId(rawJobId);

  if (!jobId) {
    sendError(client, 'VALIDATION_ERROR', 'jobId is required.');
    return;
  }

  subscriptionManager.unsubscribeClientFromJob(client, jobId);
  subscriptionManager.sendJson(client, {
    type: MESSAGE_TYPES.UNSUBSCRIBED,
    jobId,
    timestamp: new Date().toISOString()
  });
};

const handleClientMessage = async (client, rawMessage) => {
  let message;

  try {
    message = JSON.parse(rawMessage.toString('utf8'));
  } catch (error) {
    sendError(client, 'INVALID_MESSAGE', 'Invalid WebSocket message.');
    return;
  }

  const action = String(message.action || '').trim().toLowerCase();

  if (action === 'subscribe') {
    await handleSubscribe(client, message.jobId);
    return;
  }

  if (action === 'unsubscribe') {
    handleUnsubscribe(client, message.jobId);
    return;
  }

  sendError(client, 'UNSUPPORTED_ACTION', 'Unsupported WebSocket action.');
};

const initWebSocketServer = (httpServer) => {
  if (webSocketServer) {
    return webSocketServer;
  }

  webSocketServer = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: config.websocket.maxPayloadBytes
  });

  webSocketServer.on('connection', (client) => {
    subscriptionManager.addClient(client);

    client.on('message', (rawMessage) => {
      handleClientMessage(client, rawMessage).catch((error) => {
        console.error(`WebSocket message handling failed: ${error.message}`);
        sendError(client, 'INTERNAL_ERROR', 'Unable to process WebSocket message.');
      });
    });

    client.on('close', () => {
      subscriptionManager.removeClient(client);
    });

    client.on('error', (error) => {
      console.error(`WebSocket client error: ${error.message}`);
      subscriptionManager.removeClient(client);
    });
  });

  webSocketServer.on('error', (error) => {
    console.error(`WebSocket server error: ${error.message}`);
  });

  startHeartbeatPublisher();
  console.log(`WebSocket server listening on /ws with ${config.websocket.heartbeatIntervalMs} ms heartbeat.`);
  return webSocketServer;
};

const closeWebSocketServer = async () => {
  stopHeartbeatPublisher();

  if (!webSocketServer) {
    return;
  }

  await new Promise((resolve) => {
    webSocketServer.close(() => resolve());
  });
  webSocketServer = null;
};

const getWebSocketStatus = () => ({
  status: webSocketServer ? 'ok' : 'not_started',
  heartbeatIntervalMs: config.websocket.heartbeatIntervalMs,
  ...subscriptionManager.getRuntimeStatus()
});

module.exports = {
  closeWebSocketServer,
  getWebSocketStatus,
  initWebSocketServer
};
