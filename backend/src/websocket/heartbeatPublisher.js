const config = require('../config/env');
const workerStateService = require('../services/workerStateService');
const subscriptionManager = require('./subscriptionManager');
const { publishHeartbeat } = require('./eventPublisher');
const { TERMINAL_PHASES } = require('./messageTypes');

let heartbeatTimer = null;

const publishLiveHeartbeats = async () => {
  const subscribedJobIds = subscriptionManager.getSubscribedJobIds();

  for (const jobId of subscribedJobIds) {
    const state = workerStateService.getState(jobId);

    if (!state || TERMINAL_PHASES.has(state.phase)) {
      continue;
    }

    await publishHeartbeat(jobId).catch((error) => {
      console.error(`WebSocket heartbeat failed for ${jobId}: ${error.message}`);
    });
  }
};

const startHeartbeatPublisher = () => {
  if (heartbeatTimer) {
    return heartbeatTimer;
  }

  heartbeatTimer = setInterval(publishLiveHeartbeats, config.websocket.heartbeatIntervalMs);
  heartbeatTimer.unref();
  return heartbeatTimer;
};

const stopHeartbeatPublisher = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

module.exports = {
  publishLiveHeartbeats,
  startHeartbeatPublisher,
  stopHeartbeatPublisher
};
