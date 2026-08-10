import api from '../api';

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
  const response = await api.get('/health');
  return response.data;
};

export const listSkills = async () => {
  const response = await api.get('/api/skills');
  return response.data;
};

export const createSkillJob = async (skillId, { files = {}, parameters = {}, browserTabSessionId, idempotencyKey }) => {
  const formData = new FormData();
  formData.append('browserTabSessionId', browserTabSessionId);
  formData.append('idempotencyKey', idempotencyKey);
  formData.append('parameters', JSON.stringify(parameters));
  Object.entries(files).forEach(([name, selected]) => {
    const values = Array.isArray(selected) ? selected : [selected];
    values.filter(Boolean).forEach((file) => formData.append(name, file));
  });
  const response = await api.post(`/api/skills/${encodeURIComponent(skillId)}/jobs`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: JOB_CREATION_TIMEOUT_MS
  });
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
