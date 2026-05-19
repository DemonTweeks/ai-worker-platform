const mongoose = require('mongoose');

const AUDIT_STATUSES = ['success', 'failed'];

const AdminAuditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    admin: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    assetType: {
      type: String,
      trim: true
    },
    version: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: AUDIT_STATUSES,
      default: 'success',
      index: true
    },
    ip: {
      type: String,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'admin_audit_logs',
    versionKey: false
  }
);

AdminAuditLogSchema.index({ admin: 1, timestamp: -1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema);
module.exports.AUDIT_STATUSES = AUDIT_STATUSES;
