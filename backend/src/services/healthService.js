const fs = require('fs');
const os = require('os');
const path = require('path');
const packageJson = require('../../package.json');
const config = require('../config/env');
const { getMongoStatus } = require('../db/mongo');
const { getQueueState } = require('../queue/jobQueue');
const storageService = require('./storageService');
const { getWebSocketStatus } = require('../websocket/server');
const { generateText } = require('../llm/llmClient');
const { getLlmStatus, isLlmConfigured, redactSensitive } = require('../llm/llmUtils');

const LLM_HEALTH_CACHE_MS = 60 * 1000;
const LLM_HEALTH_TIMEOUT_MS = 5000;
let llmReachabilityCache = null;

const nowIso = () => new Date().toISOString();

const safeError = (error) => (error && error.message ? redactSensitive(error.message) : 'Health check failed.');

const serviceResult = async (check) => {
  try {
    return await check();
  } catch (error) {
    return {
      status: 'unknown',
      lastCheckedAt: nowIso(),
      lastError: safeError(error)
    };
  }
};

const overallStatus = (services) => {
  const criticalStatuses = [
    services.backend.status,
    services.mongodb.status,
    services.storage.status,
    services.queue.status
  ];

  if (criticalStatuses.includes('down')) {
    return 'down';
  }

  if (Object.values(services).some((service) => ['degraded', 'unknown', 'not_configured'].includes(service.status))) {
    return 'degraded';
  }

  return 'ok';
};

const sanitizeRootLabel = (rootPath) => {
  if (!rootPath) {
    return '';
  }

  return path.basename(rootPath);
};

const checkBackend = async () => ({
  status: 'ok',
  service: 'ai-worker-platform-backend',
  uptimeSeconds: Math.round(process.uptime()),
  version: packageJson.version || '',
  nodeVersion: process.version,
  platform: os.platform(),
  lastCheckedAt: nowIso()
});

const checkMongo = async () => {
  const mongo = getMongoStatus();
  const connected = mongo.readyState === 1 || mongo.status === 'connected';

  return {
    status: connected ? 'ok' : 'down',
    connected,
    readyState: mongo.readyState,
    readyStateLabel: mongo.readyStateLabel,
    lastConnectedAt: mongo.lastConnectedAt,
    lastDisconnectedAt: mongo.lastDisconnectedAt,
    lastError: mongo.lastError ? redactSensitive(mongo.lastError) : null,
    lastCheckedAt: nowIso()
  };
};

const getDiskStatus = async (rootPath) => {
  if (!fs.promises.statfs) {
    return {
      available: false,
      reason: 'statfs_unavailable'
    };
  }

  try {
    const stats = await fs.promises.statfs(rootPath);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const usedPercent = totalBytes > 0 ? Number((((totalBytes - freeBytes) / totalBytes) * 100).toFixed(2)) : null;

    return {
      available: true,
      freeBytes,
      totalBytes,
      usedPercent
    };
  } catch (error) {
    return {
      available: false,
      reason: safeError(error)
    };
  }
};

const runStorageWriteProbe = async (rootPath) => {
  const probePath = path.join(rootPath, 'temp', `.health-probe-${process.pid}-${Date.now()}.tmp`);

  try {
    await fs.promises.mkdir(path.dirname(probePath), { recursive: true });
    await fs.promises.writeFile(probePath, 'ok');
    await fs.promises.rm(probePath, { force: true });
    return true;
  } catch (error) {
    await fs.promises.rm(probePath, { force: true }).catch(() => {});
    return false;
  }
};

const checkStorage = async () => {
  const storage = storageService.getStorageStatus();
  const root = storageService.getStorageRoot();
  const rootExists = Boolean(storage.exists);
  const writable = rootExists ? await runStorageWriteProbe(root) : false;
  const requiredFolders = Object.fromEntries(
    Object.entries(storage.folders || {}).map(([name, value]) => [name, { exists: Boolean(value.exists) }])
  );
  const foldersOk = Object.values(requiredFolders).every((folder) => folder.exists);
  const disk = rootExists ? await getDiskStatus(root) : { available: false, reason: 'storage_root_missing' };
  const status = rootExists && writable && foldersOk ? 'ok' : 'down';

  return {
    status,
    rootConfigured: Boolean(config.storageRoot),
    rootLabel: sanitizeRootLabel(root),
    rootExists,
    writable,
    requiredFolders,
    disk,
    lastError: storage.lastError ? redactSensitive(storage.lastError) : null,
    lastCheckedAt: nowIso()
  };
};

const runLlmReachabilityCheck = async () => {
  if (llmReachabilityCache && Date.now() - llmReachabilityCache.checkedAtMs < LLM_HEALTH_CACHE_MS) {
    return llmReachabilityCache.value;
  }

  const result = await generateText({
    task: 'health_check',
    systemPrompt: 'You are a health check endpoint. Reply with exactly OK.',
    userPrompt: 'Reply with exactly OK.',
    temperature: 0,
    maxTokens: 8,
    timeoutMs: LLM_HEALTH_TIMEOUT_MS
  });

  const value = result.ok
    ? {
      reachable: true,
      lastReachableAt: nowIso(),
      lastError: null
    }
    : {
      reachable: false,
      lastReachableAt: null,
      lastError: result.message || 'LLM health check failed.'
    };

  llmReachabilityCache = {
    checkedAtMs: Date.now(),
    value
  };

  return value;
};

const checkLlm = async () => {
  const llm = getLlmStatus();

  if (!llm.enabled) {
    return {
      status: 'disabled',
      ...llm,
      reachable: false,
      lastCheckedAt: nowIso()
    };
  }

  if (!isLlmConfigured()) {
    return {
      status: 'not_configured',
      ...llm,
      reachable: false,
      lastCheckedAt: nowIso()
    };
  }

  const reachability = await runLlmReachabilityCheck();

  return {
    status: reachability.reachable ? 'ok' : 'degraded',
    ...llm,
    reachable: reachability.reachable,
    lastReachableAt: reachability.lastReachableAt,
    lastError: reachability.lastError ? redactSensitive(reachability.lastError) : null,
    lastCheckedAt: nowIso()
  };
};

const checkQueue = async () => {
  const queue = getQueueState();
  const capacityAvailable = Math.max((queue.maxConcurrentJobs || 0) - (queue.activeCount || 0), 0);

  return {
    status: 'ok',
    maxConcurrentJobs: queue.maxConcurrentJobs,
    activeCount: queue.activeCount,
    queuedCount: queue.queuedCount,
    queueLength: queue.queuedCount,
    capacityAvailable,
    activeJobIds: queue.activeJobIds || [],
    queuedJobIds: queue.queuedJobIds || [],
    lastCheckedAt: nowIso()
  };
};

const checkWebSocket = async () => {
  const websocket = getWebSocketStatus();

  return {
    status: websocket.status === 'ok' ? 'ok' : 'degraded',
    connectedClients: websocket.connectedClients || 0,
    subscribedJobs: websocket.subscribedJobs || 0,
    heartbeatIntervalMs: websocket.heartbeatIntervalMs,
    lastCheckedAt: nowIso()
  };
};

const buildHealthResponse = async () => {
  const timestamp = nowIso();
  const services = {
    backend: await serviceResult(checkBackend),
    mongodb: await serviceResult(checkMongo),
    storage: await serviceResult(checkStorage),
    llm: await serviceResult(checkLlm),
    queue: await serviceResult(checkQueue),
    websocket: await serviceResult(checkWebSocket)
  };
  const status = overallStatus(services);

  return {
    status,
    service: 'ai-worker-platform-backend',
    timestamp,
    uptimeSeconds: services.backend.uptimeSeconds,
    version: services.backend.version,
    environment: process.env.NODE_ENV || 'local',
    services,
    // Backward-compatible top-level fields used by earlier UI layers.
    backend: services.backend,
    mongo: services.mongodb,
    storage: services.storage,
    llm: services.llm,
    queue: services.queue,
    websocket: services.websocket
  };
};

module.exports = {
  buildHealthResponse
};
