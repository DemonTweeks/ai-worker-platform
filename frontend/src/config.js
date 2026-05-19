const hasEnvValue = (key) => Object.prototype.hasOwnProperty.call(import.meta.env, key);

const apiBaseUrl = hasEnvValue('VITE_API_BASE_URL')
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://127.0.0.1:8000';

const deriveWsUrl = () => {
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
  }

  return `${window.location.origin.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`;
};

export const API_BASE_URL = apiBaseUrl;

export const WS_URL = hasEnvValue('VITE_WS_URL') && import.meta.env.VITE_WS_URL
  ? import.meta.env.VITE_WS_URL
  : deriveWsUrl();
