const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const adminAuthService = require('../services/adminAuthService');
const auditService = require('../services/auditService');
const deploymentService = require('../services/deploymentService');
const { createApiError } = require('../utils/apiError');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => (
  Promise.resolve(handler(req, res, next)).catch(next)
);

const getRequestIp = (req) => (
  req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress
);

router.post('/login', asyncHandler(async (req, res) => {
  const result = await adminAuthService.loginAdmin(req.body, { ip: getRequestIp(req) });
  res.json(result);
}));

router.use(adminAuth);

router.post('/logout', asyncHandler(async (req, res) => {
  const result = await adminAuthService.logoutAdmin(req.adminUser, { ip: getRequestIp(req) });
  res.json(result);
}));

router.post('/assets/upload', asyncHandler(async (req, res) => {
  throw createApiError(409, 'ASSET_MANAGEMENT_DISABLED', 'Business assets are owned by create-pr-cd and are not user-manageable.');
}));

router.post('/assets/:version/activate', asyncHandler(async (req, res) => {
  throw createApiError(409, 'ASSET_MANAGEMENT_DISABLED', 'Business assets are owned by create-pr-cd and are not user-manageable.');
}));

router.get('/assets', asyncHandler(async (req, res) => {
  res.json({ activeByType: {}, items: [] });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const result = await auditService.listAuditLogs(req.query);
  res.json(result);
}));

router.post('/deploy', asyncHandler(async (req, res) => {
  const audit = {
    admin: req.adminUser.username,
    action: 'deployment_triggered',
    ip: getRequestIp(req)
  };
  const result = deploymentService.startDeployment();
  auditService.writeAuditLog({
    ...audit,
    metadata: { startedAt: result.startedAt, execution: 'fire_and_forget' }
  }).catch((auditError) => {
    console.error(`DEPLOYMENT_AUDIT_FAILED: ${auditError.message}`);
  });

  res.status(202).json(result);
}));

module.exports = router;
