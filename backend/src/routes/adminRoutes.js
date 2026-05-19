const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const adminAuth = require('../middleware/adminAuth');
const adminAuthService = require('../services/adminAuthService');
const assetService = require('../services/assetService');
const auditService = require('../services/auditService');

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

router.post('/assets/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const result = await assetService.uploadAsset({
    assetType: req.body.assetType,
    file: req.file,
    adminUser: req.adminUser,
    ip: getRequestIp(req)
  });
  res.status(201).json(result);
}));

router.post('/assets/:version/activate', asyncHandler(async (req, res) => {
  const result = await assetService.activateAsset({
    assetType: req.body.assetType || req.query.assetType,
    version: req.params.version,
    adminUser: req.adminUser,
    ip: getRequestIp(req)
  });
  res.json(result);
}));

router.get('/assets', asyncHandler(async (req, res) => {
  const result = await assetService.listAssets(req.query);
  res.json(result);
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const result = await auditService.listAuditLogs(req.query);
  res.json(result);
}));

module.exports = router;
