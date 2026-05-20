const fs = require('fs');
const path = require('path');
const { Asset } = require('../models');
const storageService = require('./storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');
const { createApiError } = require('../utils/apiError');

const REQUIRED_ASSETS = ['pr_model', 'ecc_template'];

const assetVersionKeys = {
  pr_model: 'prModel',
  ecc_template: 'eccTemplate'
};

const assetPathKeys = {
  pr_model: 'prModelPath',
  ecc_template: 'eccTemplatePath'
};

const loadActiveAssets = async () => {
  const assets = await Asset.find({ assetType: { $in: REQUIRED_ASSETS }, isActive: true }).lean();
  const assetsByType = Object.fromEntries(assets.map((asset) => [asset.assetType, asset]));
  const missing = REQUIRED_ASSETS.filter((assetType) => !assetsByType[assetType]);

  if (missing.length > 0) {
    throw createApiError(
      409,
      'ACTIVE_ASSET_MISSING',
      `Missing active asset(s): ${missing.join(', ')}.`,
      { missing }
    );
  }

  const assetVersions = {};
  const paths = {};

  for (const assetType of REQUIRED_ASSETS) {
    const asset = assetsByType[assetType];
    const absolutePath = assertPathInsideRoot(
      storageService.getStorageRoot(),
      path.join(storageService.getStorageRoot(), asset.filePath)
    );

    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
    } catch (error) {
      throw createApiError(
        409,
        'ACTIVE_ASSET_FILE_MISSING',
        `Active asset file is missing for ${assetType}.`,
        { assetType, version: asset.version }
      );
    }

    assetVersions[assetVersionKeys[assetType]] = asset.version;
    paths[assetPathKeys[assetType]] = absolutePath;
  }

  return {
    assetVersions,
    paths,
    assetsByType
  };
};

module.exports = {
  REQUIRED_ASSETS,
  loadActiveAssets
};
