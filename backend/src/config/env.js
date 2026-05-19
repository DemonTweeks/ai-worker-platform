const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const config = {
  port: numberFromEnv('PORT', 8000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai-worker-platform',
  storageRoot: process.env.STORAGE_ROOT || path.resolve(__dirname, '../../../storage'),
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
  admin: {
    defaultUsername: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD || ''
  }
};

module.exports = config;
