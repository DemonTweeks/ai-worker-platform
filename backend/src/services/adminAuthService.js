const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AdminUser } = require('../models');
const { createApiError } = require('../utils/apiError');
const { writeAuditLog } = require('./auditService');

const SALT_ROUNDS = 12;

const serializeAdmin = (adminUser) => ({
  username: adminUser.username,
  createdAt: adminUser.createdAt,
  lastLoginAt: adminUser.lastLoginAt,
  isActive: adminUser.isActive
});

const normalizeUsername = (username) => String(username || '').trim().toLowerCase();

const ensureJwtConfigured = () => {
  if (!config.admin.jwtSecret) {
    throw createApiError(500, 'JWT_SECRET_NOT_CONFIGURED', 'Admin JWT secret is not configured.');
  }
};

const ensureDefaultAdmin = async () => {
  const existingCount = await AdminUser.countDocuments();

  if (existingCount > 0) {
    return null;
  }

  if (!config.admin.defaultUsername || !config.admin.defaultPassword) {
    throw createApiError(
      500,
      'DEFAULT_ADMIN_NOT_CONFIGURED',
      'Default admin credentials are not configured.'
    );
  }

  const passwordHash = await bcrypt.hash(config.admin.defaultPassword, SALT_ROUNDS);
  return AdminUser.create({
    username: normalizeUsername(config.admin.defaultUsername),
    passwordHash,
    isActive: true
  });
};

const signToken = (adminUser) => {
  ensureJwtConfigured();
  return jwt.sign(
    {
      sub: adminUser._id.toString(),
      username: adminUser.username,
      role: 'admin'
    },
    config.admin.jwtSecret,
    { expiresIn: config.admin.jwtExpiresIn }
  );
};

const loginAdmin = async ({ username, password }, requestInfo = {}) => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    await writeAuditLog({
      admin: normalizedUsername || 'unknown',
      action: 'LOGIN_FAILED',
      status: 'failed',
      ip: requestInfo.ip,
      metadata: { reason: 'missing_credentials' }
    });
    throw createApiError(400, 'VALIDATION_ERROR', 'username and password are required.');
  }

  await ensureDefaultAdmin();

  const adminUser = await AdminUser.findOne({ username: normalizedUsername });

  if (!adminUser) {
    await writeAuditLog({
      admin: normalizedUsername,
      action: 'LOGIN_FAILED',
      status: 'failed',
      ip: requestInfo.ip,
      metadata: { reason: 'unknown_username' }
    });
    throw createApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  if (!adminUser.isActive) {
    await writeAuditLog({
      admin: normalizedUsername,
      action: 'LOGIN_FAILED',
      status: 'failed',
      ip: requestInfo.ip,
      metadata: { reason: 'inactive_admin' }
    });
    throw createApiError(403, 'ADMIN_INACTIVE', 'Admin account is inactive.');
  }

  const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash);

  if (!passwordMatches) {
    await writeAuditLog({
      admin: normalizedUsername,
      action: 'LOGIN_FAILED',
      status: 'failed',
      ip: requestInfo.ip,
      metadata: { reason: 'invalid_password' }
    });
    throw createApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
  }

  adminUser.lastLoginAt = new Date();
  await adminUser.save();

  await writeAuditLog({
    admin: adminUser.username,
    action: 'LOGIN_SUCCESS',
    status: 'success',
    ip: requestInfo.ip
  });

  return {
    token: signToken(adminUser),
    tokenType: 'Bearer',
    expiresIn: config.admin.jwtExpiresIn,
    admin: serializeAdmin(adminUser)
  };
};

const verifyAdminToken = async (token) => {
  ensureJwtConfigured();

  let payload;

  try {
    payload = jwt.verify(token, config.admin.jwtSecret);
  } catch (error) {
    throw createApiError(401, 'INVALID_TOKEN', 'Admin token is invalid or expired.');
  }

  const adminUser = await AdminUser.findById(payload.sub);

  if (!adminUser) {
    throw createApiError(401, 'INVALID_TOKEN', 'Admin token is invalid.');
  }

  if (!adminUser.isActive) {
    throw createApiError(403, 'ADMIN_INACTIVE', 'Admin account is inactive.');
  }

  return adminUser;
};

const logoutAdmin = async (adminUser, requestInfo = {}) => {
  await writeAuditLog({
    admin: adminUser.username,
    action: 'LOGOUT',
    status: 'success',
    ip: requestInfo.ip
  });

  return {
    message: 'Logout acknowledged. The client should discard the JWT token.'
  };
};

module.exports = {
  ensureDefaultAdmin,
  loginAdmin,
  logoutAdmin,
  serializeAdmin,
  verifyAdminToken
};
