const { createApiError } = require('../utils/apiError');
const { verifyAdminToken, serializeAdmin } = require('../services/adminAuthService');

const extractBearerToken = (authorizationHeader) => {
  const value = String(authorizationHeader || '').trim();

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(/\s+/);

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const adminAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw createApiError(401, 'AUTH_REQUIRED', 'Admin authentication is required.');
    }

    const adminUser = await verifyAdminToken(token);
    req.adminUser = adminUser;
    req.admin = serializeAdmin(adminUser);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = adminAuth;
