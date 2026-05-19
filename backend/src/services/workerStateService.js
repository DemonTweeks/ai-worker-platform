const PHASES = {
  QUEUED: 'QUEUED',
  VALIDATION_STARTED: 'VALIDATION_STARTED',
  VALIDATION_COMPLETED: 'VALIDATION_COMPLETED',
  FILTERING_STARTED: 'FILTERING_STARTED',
  FILTERING_COMPLETED: 'FILTERING_COMPLETED',
  ASSET_LOADING_STARTED: 'ASSET_LOADING_STARTED',
  ASSET_LOADING_COMPLETED: 'ASSET_LOADING_COMPLETED',
  GENERATION_STARTED: 'GENERATION_STARTED',
  GENERATION_COMPLETED: 'GENERATION_COMPLETED',
  OUTPUT_COLLECTION_STARTED: 'OUTPUT_COLLECTION_STARTED',
  OUTPUT_COLLECTION_COMPLETED: 'OUTPUT_COLLECTION_COMPLETED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

const states = new Map();

const now = () => new Date().toISOString();

const createState = (jobId, initialPhase = PHASES.QUEUED) => {
  const state = {
    jobId,
    phase: initialPhase,
    processedRows: 0,
    totalRows: 0,
    cancellationRequested: false,
    startedAt: null,
    updatedAt: now(),
    completedAt: null,
    error: null,
    heartbeat: {
      message: 'Job queued.',
      timestamp: now()
    }
  };

  states.set(jobId, state);
  return { ...state, heartbeat: { ...state.heartbeat } };
};

const getOrCreateState = (jobId) => {
  if (!states.has(jobId)) {
    return createState(jobId);
  }

  return getState(jobId);
};

const mutateState = (jobId, mutator) => {
  const state = states.get(jobId) || createState(jobId);
  mutator(state);
  state.updatedAt = now();
  state.heartbeat.timestamp = state.updatedAt;
  states.set(jobId, state);
  return getState(jobId);
};

const setPhase = (jobId, phase, message) => mutateState(jobId, (state) => {
  state.phase = phase;
  if (!state.startedAt && phase !== PHASES.QUEUED) {
    state.startedAt = now();
  }
  state.heartbeat.message = message || phase;
});

const setProgress = (jobId, { processedRows, totalRows, message } = {}) => mutateState(jobId, (state) => {
  if (Number.isFinite(processedRows)) {
    state.processedRows = processedRows;
  }
  if (Number.isFinite(totalRows)) {
    state.totalRows = totalRows;
  }
  if (message) {
    state.heartbeat.message = message;
  }
});

const requestCancellation = (jobId) => mutateState(jobId, (state) => {
  state.cancellationRequested = true;
  state.heartbeat.message = 'Cancellation requested.';
});

const isCancellationRequested = (jobId) => {
  const state = states.get(jobId);
  return Boolean(state && state.cancellationRequested);
};

const setError = (jobId, error) => mutateState(jobId, (state) => {
  state.phase = PHASES.FAILED;
  state.error = {
    code: error.code || 'WORKER_ERROR',
    message: error.message || 'Worker failed.'
  };
  state.completedAt = now();
  state.heartbeat.message = state.error.message;
});

const setComplete = (jobId, message = 'Job completed.') => mutateState(jobId, (state) => {
  state.phase = PHASES.COMPLETED;
  state.completedAt = now();
  state.heartbeat.message = message;
});

const setCancelled = (jobId, message = 'Job cancelled.') => mutateState(jobId, (state) => {
  state.phase = PHASES.CANCELLED;
  state.completedAt = now();
  state.heartbeat.message = message;
});

const getState = (jobId) => {
  const state = states.get(jobId);
  if (!state) {
    return null;
  }

  return {
    ...state,
    heartbeat: { ...state.heartbeat },
    error: state.error ? { ...state.error } : null
  };
};

const removeState = (jobId) => {
  states.delete(jobId);
};

const getAllStates = () => Array.from(states.values()).map((state) => getState(state.jobId));

module.exports = {
  PHASES,
  createState,
  getAllStates,
  getOrCreateState,
  getState,
  isCancellationRequested,
  removeState,
  requestCancellation,
  setCancelled,
  setComplete,
  setError,
  setPhase,
  setProgress
};
