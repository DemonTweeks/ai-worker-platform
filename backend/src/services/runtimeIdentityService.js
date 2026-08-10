const crypto = require('crypto');
const os = require('os');

const sanitizeIdentity = (value, fallback) => {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120);
  return normalized || fallback;
};

const machineId = sanitizeIdentity(process.env.AI_WORKER_MACHINE_ID || os.hostname(), 'unknown-machine');
const runtimeInstanceId = sanitizeIdentity(
  process.env.AI_WORKER_RUNTIME_INSTANCE_ID || crypto.randomUUID(),
  crypto.randomUUID()
);

const getRuntimeIdentity = () => ({ machineId, runtimeInstanceId });

module.exports = {
  getRuntimeIdentity,
  machineId,
  runtimeInstanceId
};
