import api from '../api';
import {
  buildAdminAuthHeader,
  clearAdminSession,
  saveAdminSession
} from '../services/adminAuthStore';

const unwrapError = (error) => {
  if (error.response && error.response.status === 401) {
    clearAdminSession();
    window.dispatchEvent(new CustomEvent('admin-unauthorized'));
  }
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error.message;
  }
  if (error.response && error.response.data && error.response.data.message) {
    return error.response.data.message;
  }
  return error.message || 'Request failed.';
};

const adminHeaders = () => ({
  headers: buildAdminAuthHeader()
});

export const loginAdmin = async ({ username, password }) => {
  const response = await api.post('/api/admin/login', { username, password });
  if (response.data && response.data.token) {
    saveAdminSession(response.data);
  }
  return response.data;
};

export const logoutAdmin = async () => {
  try {
    const response = await api.post('/api/admin/logout', {}, adminHeaders());
    return response.data;
  } finally {
    clearAdminSession();
  }
};

export const listAuditLogs = async (params = {}) => {
  const response = await api.get('/api/admin/audit-logs', {
    ...adminHeaders(),
    params
  });
  return response.data;
};

export const triggerDeployment = async () => {
  const response = await api.post('/api/admin/deploy', {}, adminHeaders());
  return response.data;
};

export const getAdminErrorMessage = unwrapError;
