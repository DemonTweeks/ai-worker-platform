const TOKEN_KEY = 'ai_worker_platform_admin_token';
const ADMIN_KEY = 'ai_worker_platform_admin_user';

export const getAdminToken = () => window.localStorage.getItem(TOKEN_KEY) || '';

export const getAdminUser = () => {
  const raw = window.localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

export const isAdminAuthenticated = () => Boolean(getAdminToken());

export const saveAdminSession = ({ token, admin }) => {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin || {}));
};

export const clearAdminSession = () => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_KEY);
};

export const buildAdminAuthHeader = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
