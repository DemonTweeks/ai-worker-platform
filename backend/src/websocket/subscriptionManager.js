const { WebSocket } = require('ws');
const { Job } = require('../models');

const clients = new Set();
const subscriptionsByJobId = new Map();
const subscriptionsByClient = new Map();

const addClient = (client) => {
  clients.add(client);
  subscriptionsByClient.set(client, new Set());
};

const removeClient = (client) => {
  const jobIds = subscriptionsByClient.get(client) || new Set();

  for (const jobId of jobIds) {
    const subscribers = subscriptionsByJobId.get(jobId);
    if (subscribers) {
      subscribers.delete(client);
      if (subscribers.size === 0) {
        subscriptionsByJobId.delete(jobId);
      }
    }
  }

  subscriptionsByClient.delete(client);
  clients.delete(client);
};

const isClientOpen = (client) => client.readyState === WebSocket.OPEN;

const sendJson = (client, message) => {
  if (!isClientOpen(client)) {
    return false;
  }

  client.send(JSON.stringify(message));
  return true;
};

const subscribeClientToJob = async (client, jobId) => {
  const job = await Job.findOne({ jobId }).lean();

  if (!job) {
    return null;
  }

  if (!subscriptionsByJobId.has(jobId)) {
    subscriptionsByJobId.set(jobId, new Set());
  }

  subscriptionsByJobId.get(jobId).add(client);

  if (!subscriptionsByClient.has(client)) {
    subscriptionsByClient.set(client, new Set());
  }

  subscriptionsByClient.get(client).add(jobId);
  return job;
};

const unsubscribeClientFromJob = (client, jobId) => {
  const clientJobs = subscriptionsByClient.get(client);

  if (clientJobs) {
    clientJobs.delete(jobId);
  }

  const subscribers = subscriptionsByJobId.get(jobId);

  if (subscribers) {
    subscribers.delete(client);
    if (subscribers.size === 0) {
      subscriptionsByJobId.delete(jobId);
    }
  }
};

const publishToJob = (jobId, message) => {
  const subscribers = subscriptionsByJobId.get(jobId);

  if (!subscribers || subscribers.size === 0) {
    return 0;
  }

  let sent = 0;

  for (const client of subscribers) {
    if (sendJson(client, message)) {
      sent += 1;
    }
  }

  return sent;
};

const getSubscribedJobIds = () => Array.from(subscriptionsByJobId.keys());

const getRuntimeStatus = () => ({
  connectedClients: clients.size,
  subscribedJobs: subscriptionsByJobId.size,
  subscriptions: Object.fromEntries(
    Array.from(subscriptionsByJobId.entries()).map(([jobId, subscribers]) => [jobId, subscribers.size])
  )
});

module.exports = {
  addClient,
  getRuntimeStatus,
  getSubscribedJobIds,
  publishToJob,
  removeClient,
  sendJson,
  subscribeClientToJob,
  unsubscribeClientFromJob
};
