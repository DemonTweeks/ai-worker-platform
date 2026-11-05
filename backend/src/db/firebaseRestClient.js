const config = require('../config/env');

let mockDb = {};
const mockTransactions = new Map();

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

const replaceNestedValue = (obj, path, value) => {
  const parts = path.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  if (parts.length > 0) {
    current[parts[parts.length - 1]] = value;
  }
};

const getBaseUrl = () => {
  const url = config.firebaseDbUrl;
  return url.replace(/\/$/, ''); // Remove trailing slash
};

const makeRequest = async (path, options = {}) => {
  const cleanPath = path.replace(/^\//, '').replace(/\s+/g, '-');

  if (config.firebaseDbMock) {
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
    if (options.method === 'PUT') {
      const payload = JSON.parse(options.body);
      replaceNestedValue(mockDb, cleanPath, payload);
      return payload;
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

const replaceFirebase = (path, payload) => makeRequest(path, {
  method: 'PUT',
  body: JSON.stringify(payload)
});

const cloneJson = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const transactMock = async (cleanPath, updater) => {
  const previous = mockTransactions.get(cleanPath) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  mockTransactions.set(cleanPath, queued);
  await previous;
  try {
    const existing = cloneJson(getNestedValue(mockDb, cleanPath));
    const next = await updater(existing);
    if (next === undefined) return { committed: false, snapshot: existing };
    replaceNestedValue(mockDb, cleanPath, cloneJson(next));
    return { committed: true, snapshot: cloneJson(next) };
  } finally {
    release();
    if (mockTransactions.get(cleanPath) === queued) mockTransactions.delete(cleanPath);
  }
};

const transactionFirebase = async (path, updater, { maxRetries = 8 } = {}) => {
  const cleanPath = path.replace(/^\//, '').replace(/\s+/g, '-');
  if (config.firebaseDbMock) return transactMock(cleanPath, updater);

  const url = `${getBaseUrl()}/${cleanPath}.json`;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const readResponse = await fetch(url, {
      method: 'GET',
      headers: { 'X-Firebase-ETag': 'true' }
    });
    if (!readResponse.ok) {
      throw new Error(`Firebase DB transaction read failed: ${readResponse.status} ${readResponse.statusText}`);
    }
    const existing = await readResponse.json();
    const next = await updater(cloneJson(existing));
    if (next === undefined) return { committed: false, snapshot: existing };
    const etag = readResponse.headers.get('etag');
    const writeResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'if-match': etag || '*'
      },
      body: JSON.stringify(next)
    });
    if (writeResponse.status === 412) continue;
    if (!writeResponse.ok) {
      throw new Error(`Firebase DB transaction write failed: ${writeResponse.status} ${writeResponse.statusText}`);
    }
    return { committed: true, snapshot: await writeResponse.json() };
  }
  const error = new Error(`Firebase DB transaction contention exceeded ${maxRetries} attempts.`);
  error.code = 'FIREBASE_TRANSACTION_CONTENTION';
  throw error;
};

module.exports = {
  readFirebase,
  writeFirebase,
  pushFirebase,
  replaceFirebase,
  transactionFirebase,
  getBaseUrl
};
