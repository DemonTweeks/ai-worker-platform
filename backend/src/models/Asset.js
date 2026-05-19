const mongoose = require('mongoose');

const ASSET_TYPES = ['pr_model', 'contract_info', 'ecc_template'];

const AssetSchema = new mongoose.Schema(
  {
    assetType: {
      type: String,
      required: true,
      enum: ASSET_TYPES,
      index: true
    },
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true
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
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    activatedAt: Date
  },
  {
    collection: 'assets',
    versionKey: false
  }
);

AssetSchema.index({ assetType: 1, version: 1 }, { unique: true });
AssetSchema.index({ assetType: 1, isActive: 1 });

module.exports = mongoose.model('Asset', AssetSchema);
module.exports.ASSET_TYPES = ASSET_TYPES;
