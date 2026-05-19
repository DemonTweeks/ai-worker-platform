const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ quiet: true });

const repoRoot = path.resolve(__dirname, '../../..');

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const resolveFromRepoRoot = (value, fallback) => {
  const selected = value || fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(repoRoot, selected);
};

const config = {
  port: numberFromEnv('PORT', 8000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai-worker-platform',
  storageRoot: resolveFromRepoRoot(process.env.STORAGE_ROOT, './storage'),
  createPrCdRoot: resolveFromRepoRoot(process.env.CREATE_PR_CD_ROOT, './skills/create-pr-cd'),
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  limits: {
    maxUploadSizeMb: numberFromEnv('MAX_UPLOAD_SIZE_MB', 100),
    maxRowCount: numberFromEnv('MAX_ROW_COUNT', 50000),
    maxSiteCodes: numberFromEnv('MAX_SITE_CODES', 5000),
    maxConcurrentJobs: numberFromEnv('MAX_CONCURRENT_JOBS', 2),
    jobTimeoutMinutes: numberFromEnv('JOB_TIMEOUT_MINUTES', 60),
    fileRetentionDays: numberFromEnv('FILE_RETENTION_DAYS', 180)
  },
  websocket: {
    heartbeatIntervalMs: numberFromEnv('WS_HEARTBEAT_INTERVAL_MS', 5000),
    maxPayloadBytes: numberFromEnv('WS_MAX_PAYLOAD_BYTES', 16 * 1024)
  },
  admin: {
    defaultUsername: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || '',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h'
  }
};

module.exports = config;
