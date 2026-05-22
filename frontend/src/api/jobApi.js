import api from '../api';

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

export const prevalidateUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/jobs/prevalidate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const createJob = async ({ prevalidatedFileId, generationScope, siteCodes, prScope }) => {
  const response = await api.post('/api/jobs', {
    prevalidatedFileId,
    prScope,
    generationScope,
    siteCodes
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
