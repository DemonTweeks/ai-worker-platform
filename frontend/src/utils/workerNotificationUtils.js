export const WORKER_NOTIFICATION_TIMEOUT_MS = 6000;
export const WORKER_TIMEOUT_NOTIFICATION_MESSAGE = 'Request timed out. The job may still be running. Please check History.';

const responseError = (error) => (
  error && error.response && error.response.data && error.response.data.error
    ? error.response.data.error
    : null
);

export const getWorkerErrorCode = (error) => {
  const apiError = responseError(error);
  if (apiError && apiError.code) {
    return apiError.code;
  }

  return error && error.code ? error.code : '';
};

export const isWorkerTimeoutError = (error) => {
  const code = getWorkerErrorCode(error);
  if (code === 'WORKER_TIMEOUT' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return true;
  }

  const status = error && error.response ? error.response.status : null;
  if (status === 408 || status === 504) {
    return true;
  }

  const detailCode = error && error.response && error.response.data && error.response.data.code
    ? error.response.data.code
    : '';
  if (detailCode === 'WORKER_TIMEOUT') {
    return true;
  }

  return String(error && error.message ? error.message : '').toLowerCase().includes('timeout');
};

export const scheduleNotificationDismiss = ({
  activeNotificationId,
  clearTimer,
  currentTimer,
  onDismiss,
  setTimer,
  timeoutMs = WORKER_NOTIFICATION_TIMEOUT_MS
}) => {
  if (currentTimer) {
    clearTimer(currentTimer);
  }

  const expiresAt = Date.now() + timeoutMs;
  const timer = setTimer(() => {
    if (Date.now() >= expiresAt) {
      onDismiss(activeNotificationId);
    }
  }, timeoutMs);

  return {
    expiresAt,
    timer
  };
};
