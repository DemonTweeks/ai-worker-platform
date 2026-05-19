const { AdminAuditLog } = require('../models');

const sanitizeMetadata = (metadata = {}) => {
  const sensitiveKeys = new Set(['password', 'passwordHash', 'token', 'authorization', 'jwt', 'secret']);
  const sanitized = {};

  for (const [key, value] of Object.entries(metadata || {})) {
    if (!sensitiveKeys.has(String(key).toLowerCase())) {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

const writeAuditLog = async ({
  admin,
  action,
  assetType,
  version,
  status = 'success',
  ip,
  metadata = {}
}) => AdminAuditLog.create({
  admin: admin || 'unknown',
  action,
  assetType,
  version,
  status,
  ip,
  metadata: sanitizeMetadata(metadata)
});

const buildAuditFilter = (query = {}) => {
  const filter = {};

  if (query.admin) {
    filter.admin = query.admin;
  }

  if (query.action) {
    filter.action = query.action;
  }

  if (query.assetType) {
    filter.assetType = query.assetType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.dateFrom || query.dateTo) {
    filter.timestamp = {};

    if (query.dateFrom) {
      filter.timestamp.$gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filter.timestamp.$lte = new Date(query.dateTo);
    }
  }

  return filter;
};

const listAuditLogs = async (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;
  const filter = buildAuditFilter(query);
  const [items, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminAuditLog.countDocuments(filter)
  ]);

  return {
    page,
    limit,
    total,
    items: items.map((item) => ({
      timestamp: item.timestamp,
      admin: item.admin,
      action: item.action,
      assetType: item.assetType,
      version: item.version,
      status: item.status,
      ip: item.ip,
      metadata: sanitizeMetadata(item.metadata)
    }))
  };
};

module.exports = {
  listAuditLogs,
  writeAuditLog
};
