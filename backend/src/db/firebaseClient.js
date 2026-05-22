const config = require('../config/env');

let mockDb = {};

const getNestedValue = (obj, path) => {
  const parts = path.split('/');
  let current = obj;
  for (const part of parts) {
    if (!part) continue;
    if (current === undefined || current === null) return null;
    current = current[part];
  }
  return current === undefined ? null : current;
};

const setNestedValue = (obj, path, value) => {
  const parts = path.split('/');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    if (typeof value === 'object' && value !== null) {
      current[lastPart] = { ...current[lastPart], ...value };
    } else {
      current[lastPart] = value;
    }
  }
};

const getBaseUrl = () => {
  const url = process.env.FIREBASE_DB_URL || 'https://zte-app-state-mgmt-01-default-rtdb.asia-southeast1.firebasedatabase.app/ai-worker-platform';
  return url.replace(/\/$/, ''); // Remove trailing slash
};

const makeRequest = async (path, options = {}) => {
  const cleanPath = path.replace(/^\//, '').replace(/\s+/g, '-');

  if (process.env.FIREBASE_DB_MOCK === 'true') {
    if (options.method === 'GET') {
      return getNestedValue(mockDb, cleanPath);
    }
    if (options.method === 'PATCH') {
      const payload = JSON.parse(options.body);
      setNestedValue(mockDb, cleanPath, payload);
      return payload;
    }
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body);
      const pushKey = 'mockPushKey_' + Math.random().toString(36).substring(2, 15);
      setNestedValue(mockDb, `${cleanPath}/${pushKey}`, payload);
      return { name: pushKey };
    }
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/${cleanPath}.json`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firebase DB REST error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

const readFirebase = (path) => makeRequest(path, { method: 'GET' });

const writeFirebase = (path, payload) => makeRequest(path, {
  method: 'PATCH',
  body: JSON.stringify(payload)
});

const pushFirebase = (path, payload) => makeRequest(path, {
  method: 'POST',
  body: JSON.stringify(payload)
});

module.exports = {
  readFirebase,
  writeFirebase,
  pushFirebase,
  getBaseUrl
};
