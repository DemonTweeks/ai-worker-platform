// JSON tree semantics shared by the local datastore and its regression tests.
const { createApiError } = require('../utils/apiError');
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const parts = (path = '') => {
  if (typeof path !== 'string' || path.length > 1024) throw createApiError(400, 'INVALID_DATA_PATH', 'Invalid data path.');
  const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  for (const key of segments) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || /[.#$\[\]\\\x00-\x1f]/.test(key)) {
      throw createApiError(400, 'INVALID_DATA_PATH', 'Unsafe data path.');
    }
  }
  return segments;
};
const validate = (value, depth = 0) => {
  if (depth > 40) throw createApiError(400, 'INVALID_JSON', 'JSON nesting exceeds 40 levels.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || value === undefined) throw createApiError(400, 'INVALID_JSON', 'Value must be JSON.');
  for (const [key, child] of Object.entries(value)) {
    parts(key);
    if (key.includes('/')) throw createApiError(400, 'INVALID_JSON', 'JSON keys cannot contain slash.');
    validate(child, depth + 1);
  }
};
const get = (tree, path) => {
  let value = tree;
  for (const key of parts(path)) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return null;
    value = value[key];
  }
  return value === undefined ? null : clone(value);
};
const set = (tree, path, value) => {
  const keys = parts(path);
  if (!keys.length) throw createApiError(400, 'INVALID_DATA_PATH', 'Root replacement is not allowed.');
  let parent = tree;
  for (const key of keys.slice(0, -1)) {
    if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {};
    parent = parent[key];
  }
  const last = keys[keys.length - 1];
  if (value === null) delete parent[last]; else parent[last] = clone(value);
  return tree;
};
const patch = (current, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw createApiError(400, 'INVALID_PATCH', 'Patch must be an object.');
  validate(payload);
  const result = current && typeof current === 'object' ? clone(current) : {};
  for (const [key, value] of Object.entries(payload)) set(result, key, value);
  return result;
};
module.exports = { clone, parts, validate, get, set, patch };
