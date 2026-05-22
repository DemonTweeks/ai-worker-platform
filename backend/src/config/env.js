const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ quiet: true });

const repoRoot = path.resolve(__dirname, '../../..');

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const booleanFromEnv = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const resolveFromRepoRoot = (value, fallback) => {
  const selected = value || fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(repoRoot, selected);
};

const config = {
  port: numberFromEnv('PORT', 8000),
  firebaseDbUrl: process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform',
  firebaseDbMock: booleanFromEnv('FIREBASE_DB_MOCK', false),
  storageRoot: resolveFromRepoRoot(process.env.STORAGE_ROOT, './storage'),
  createPrCdRoot: resolveFromRepoRoot(process.env.CREATE_PR_CD_ROOT, './skills/create-pr-cd'),
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  llm: {
    enabled: booleanFromEnv('LLM_ENABLED', false),
    provider: process.env.LLM_PROVIDER || 'qwen',
    baseUrl: process.env.LLM_BASE_URL || '',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'Qwen3-235B-A22B',
    timeoutMs: numberFromEnv('LLM_TIMEOUT_MS', 30000),
    maxRetries: numberFromEnv('LLM_MAX_RETRIES', 1),
    progressWordingEnabled: booleanFromEnv('LLM_PROGRESS_WORDING_ENABLED', true),
    finalSummaryEnabled: booleanFromEnv('LLM_FINAL_SUMMARY_ENABLED', true),
    reAskEnabled: booleanFromEnv('LLM_REASK_ENABLED', true)
  },
  limits: {
    maxUploadSizeMb: numberFromEnv('MAX_UPLOAD_SIZE_MB', 100),
    maxRowCount: numberFromEnv('MAX_ROW_COUNT', 50000),
    maxSiteCodes: numberFromEnv('MAX_SITE_CODES', 5000),
    maxConcurrentJobs: numberFromEnv('MAX_CONCURRENT_JOBS', 2),
    jobTimeoutMinutes: numberFromEnv('JOB_TIMEOUT_MINUTES', 60),
    maxOutputFiles: numberFromEnv('MAX_OUTPUT_FILES', 200),
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
