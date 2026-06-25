const path = require('path');

const sanitizeRanStageName = (stage) => {
  if (!stage || typeof stage !== 'string') {
    return undefined;
  }

  const normalized = stage.replace(/\\/g, '/').trim();
  if (!normalized) {
    return undefined;
  }

  const fileName = path.posix.basename(normalized);
  return fileName || undefined;
};

const buildRanExecutionError = ({ type, stage, exitCode, stderr }) => {
  const safeStage = sanitizeRanStageName(stage);
  const isTimeout = type === 'timeout';
  const error = new Error(
    isTimeout
      ? `RAN pipeline timed out while running ${safeStage || 'an execution stage'}.`
      : `RAN pipeline failed while running ${safeStage || 'an execution stage'}.`
  );

  error.code = isTimeout ? 'WORKER_TIMEOUT' : 'WORKER_PROCESS_FAILED';
  error.details = {
    ...(safeStage ? { stage: safeStage } : {}),
    ...(typeof exitCode !== 'undefined' ? { exitCode } : {}),
    ...(typeof stderr === 'string' ? { stderr: stderr.slice(-2000) } : {})
  };

  return error;
};

module.exports = {
  buildRanExecutionError,
  sanitizeRanStageName
};
