const mongoose = require('mongoose');
const config = require('../config/env');

const connectionState = {
  status: 'disconnected',
  readyState: mongoose.connection.readyState,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null
};

let connectionPromise = null;
let retryTimer = null;
let intentionalDisconnect = false;

const readyStateLabels = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

const updateStatus = (status, error = null) => {
  connectionState.status = status;
  connectionState.readyState = mongoose.connection.readyState;
  connectionState.lastError = error ? error.message : null;
};

const scheduleRetry = () => {
  if (intentionalDisconnect || retryTimer || mongoose.connection.readyState === 1) {
    return;
  }

  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectMongo().catch(() => {
      scheduleRetry();
    });
  }, 5000);
};

const connectMongo = async () => {
  if (mongoose.connection.readyState === 1) {
    updateStatus('connected');
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  updateStatus('connecting');
  intentionalDisconnect = false;

  connectionPromise = mongoose
    .connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      connectionState.lastConnectedAt = new Date().toISOString();
      updateStatus('connected');
      console.log('MongoDB connected');
      return mongoose.connection;
    })
    .catch((error) => {
      updateStatus('disconnected', error);
      console.error(`MongoDB connection failed: ${error.message}`);
      scheduleRetry();
      return null;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

const getMongoStatus = () => ({
  status: connectionState.status,
  readyState: mongoose.connection.readyState,
  readyStateLabel: readyStateLabels[mongoose.connection.readyState] || 'unknown',
  lastConnectedAt: connectionState.lastConnectedAt,
  lastDisconnectedAt: connectionState.lastDisconnectedAt,
  lastError: connectionState.lastError
});

mongoose.connection.on('connected', () => {
  connectionState.lastConnectedAt = new Date().toISOString();
  updateStatus('connected');
});

mongoose.connection.on('disconnected', () => {
  connectionState.lastDisconnectedAt = new Date().toISOString();
  updateStatus('disconnected');
  console.warn('MongoDB disconnected');
  scheduleRetry();
});

mongoose.connection.on('error', (error) => {
  updateStatus('error', error);
  console.error(`MongoDB error: ${error.message}`);
});

const disconnectMongo = async () => {
  intentionalDisconnect = true;

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  await mongoose.disconnect();
};

module.exports = {
  connectMongo,
  disconnectMongo,
  getMongoStatus
};
