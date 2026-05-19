const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastLoginAt: Date,
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: 'admin_users',
    versionKey: false
  }
);

module.exports = mongoose.model('AdminUser', AdminUserSchema);
