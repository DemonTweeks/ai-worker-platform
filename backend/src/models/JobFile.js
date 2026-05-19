const mongoose = require('mongoose');

const FILE_TYPES = [
  'uploaded_export',
  'filtered_input',
  'ecc_output',
  'review_required_report',
  'warning_report',
  'summary',
  'zip_package',
  'temp'
];

const JobFileSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    fileType: {
      type: String,
      required: true,
      enum: FILE_TYPES,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0
    },
    retentionUntil: Date,
    isExpired: {
      type: Boolean,
      default: false,
      index: true
    },
    expiredAt: Date,
    deletedAt: Date,
    fileAvailable: {
      type: Boolean,
      default: true,
      index: true
    },
    cleanupReason: {
      type: String,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'job_files',
    versionKey: false
  }
);

JobFileSchema.index({ jobId: 1, fileType: 1 });

module.exports = mongoose.model('JobFile', JobFileSchema);
module.exports.FILE_TYPES = FILE_TYPES;
