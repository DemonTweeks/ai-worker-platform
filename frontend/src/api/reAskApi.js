import api from '../api';

export const askJob = async (jobId, question) => {
  const response = await api.post(`/api/jobs/${encodeURIComponent(jobId)}/ask`, { question }, {
    timeout: 45000
  });
  return response.data;
};
