const mongoose = require('mongoose');

const JOB_STATUSES = [
  'queued',
  'validating',
  'filtering_sites',
  'loading_assets',
  'generating',
  'exporting',
  'waiting_for_user_input',
  'completed',
  'completed_with_warning',
  'failed',
  'cancelled',
  'cancelled_with_partial_result'
];

const GENERATION_SCOPES = ['site_code', 'all_sites'];
const PR_SCOPES = ['TSS', 'TI'];

const JobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    workerType: {
      type: String,
      required: true,
      default: 'pr-worker',
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: JOB_STATUSES,
      default: 'queued',
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    generationScope: {
      type: String,
      enum: GENERATION_SCOPES
    },
    prScope: {
      type: String,
      enum: PR_SCOPES,
      default: 'TSS'
    },
    requestedSiteCount: {
      type: Number,
      default: 0,
      min: 0
    },
    matchedSiteCount: {
      type: Number,
      default: 0,
      min: 0
    },
    unmatchedSiteCount: {
      type: Number,
      default: 0,
      min: 0
    },
    outputFileCount: {
      type: Number,
      default: 0,
      min: 0
    },
    reviewRequiredCount: {
      type: Number,
      default: 0,
      min: 0
    },
    warningCount: {
      type: Number,
      default: 0,
      min: 0
    },
    finalWorkerSummary: {
      type: String,
      default: ''
    },
    assetVersions: {
      prModel: String,
      contractInfo: String,
      eccTemplate: String
    },
    engineVersion: String,
    fileRetentionUntil: Date,
    error: {
      code: String,
      message: String,
      stack: String,
      details: mongoose.Schema.Types.Mixed
    }
  },
  {
    collection: 'jobs',
    versionKey: false
  }
);

JobSchema.index({ workerType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Job', JobSchema);
module.exports.JOB_STATUSES = JOB_STATUSES;
module.exports.GENERATION_SCOPES = GENERATION_SCOPES;
module.exports.PR_SCOPES = PR_SCOPES;
