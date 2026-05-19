const mongoose = require('mongoose');

const SEVERITIES = ['low', 'medium', 'high'];

const ReviewRequiredItemSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    siteCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    sourceRow: {
      type: Number,
      min: 0
    },
    scope: {
      type: String,
      trim: true
    },
    subcon: {
      type: String,
      trim: true
    },
    issueType: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: SEVERITIES,
      default: 'medium'
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    collection: 'review_required_items',
    versionKey: false
  }
);

ReviewRequiredItemSchema.index({ jobId: 1, siteCode: 1 });

module.exports = mongoose.model('ReviewRequiredItem', ReviewRequiredItemSchema);
module.exports.SEVERITIES = SEVERITIES;
