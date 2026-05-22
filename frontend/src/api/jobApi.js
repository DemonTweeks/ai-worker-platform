import api from '../api';

const PREVALIDATION_TIMEOUT_MS = 120000;
const JOB_CREATION_TIMEOUT_MS = 120000;

const unwrapError = (error) => {
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error.message;
  }
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }
  return error.message || 'Request failed.';
};

export const getHealth = async () => {
  const response = await api.get('/api/health');
  return response.data;
};

export const prevalidateUpload = async (file, uploadKind = null, requestScope = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  if (uploadKind) {
    formData.append('uploadKind', uploadKind);
  }
  if (requestScope.workerId) {
    formData.append('workerId', requestScope.workerId);
  }
  if (requestScope.browserTabSessionId) {
    formData.append('browserTabSessionId', requestScope.browserTabSessionId);
  }
  const response = await api.post('/api/jobs/prevalidate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: PREVALIDATION_TIMEOUT_MS
  });
  return response.data;
};

export const createJob = async (payload) => {
  const response = await api.post('/api/jobs', payload, {
    timeout: JOB_CREATION_TIMEOUT_MS
  });
  return response.data;
};

export const listRanProjects = async () => {
  const response = await api.get('/api/jobs/ran-projects');
  return response.data;
};

export const cancelJob = async (jobId, payload = {}) => {
  const response = await api.post(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, payload);
  return response.data;
};

export const rerunJob = async (jobId, payload = {}) => {
  const response = await api.post(`/api/jobs/${encodeURIComponent(jobId)}/rerun`, payload, {
    timeout: JOB_CREATION_TIMEOUT_MS
  });
  return response.data;
};

export const listJobs = async (params = {}) => {
  const response = await api.get('/api/jobs', { params });
  return response.data;
};

export const getJobDetail = async (jobId) => {
  const response = await api.get(`/api/jobs/${encodeURIComponent(jobId)}`);
  return response.data;
};

export const getFileDownloadUrl = (jobId, fileId) => (
  `${api.defaults.baseURL}/api/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(fileId)}`
);

export const getZipDownloadUrl = (jobId) => (
  `${api.defaults.baseURL}/api/jobs/${encodeURIComponent(jobId)}/download-zip`
);

export const getErrorMessage = unwrapError;
