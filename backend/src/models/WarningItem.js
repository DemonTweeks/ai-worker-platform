const mongoose = require('mongoose');

const WarningItemSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    warningType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    siteCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    sourceRow: {
      type: Number,
      min: 0
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'warning_items',
    versionKey: false
  }
);

WarningItemSchema.index({ jobId: 1, warningType: 1 });

module.exports = mongoose.model('WarningItem', WarningItemSchema);
