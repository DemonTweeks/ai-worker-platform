const { readFirebase, writeFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

const ASSET_TYPES = ['pr_model', 'ecc_template'];

class Asset {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static findOne(filter = {}) {
    const promise = Asset.find(filter).then(list => list);
    return new QueryChain(promise, true);
  }

  static async exists(filter = {}) {
    const item = await Asset.findOne(filter);
    return item !== null;
  }

  static find(filter = {}) {
    const promise = readFirebase('assets').then(data => {
      const all = data || {};
      const items = Object.values(all).map(a => new Asset(a));
      return items.filter(a => matchFilter(a, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await Asset.find(filter);
    return list.length;
  }

  static async create(payload) {
    const assetId = payload.version; // Use version as unique ID
    const asset = new Asset({
      _id: assetId,
      ...payload,
      isActive: payload.isActive || false,
      uploadedAt: payload.uploadedAt || new Date().toISOString()
    });
    await writeFirebase(`assets/${assetId}`, asset);
    return asset;
  }

  static async updateMany(filter = {}, update = {}) {
    const list = await Asset.find(filter);
    for (const asset of list) {
      const updatedData = { ...asset, ...update.$set };
      await writeFirebase(`assets/${asset.version}`, updatedData);
    }
    return { nModified: list.length, ok: 1 };
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await Asset.create(item);
      results.push(created);
    }
    return results;
  }

  static async deleteMany(filter = {}) {
    const list = await Asset.find(filter);
    for (const asset of list) {
      await writeFirebase(`assets/${asset.version}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  async save() {
    await writeFirebase(`assets/${this.version}`, this);
    return this;
  }
}

module.exports = Asset;
module.exports.ASSET_TYPES = ASSET_TYPES;
