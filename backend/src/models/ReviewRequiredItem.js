const { readFirebase, writeFirebase, pushFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

const SEVERITIES = ['low', 'medium', 'high'];

class ReviewRequiredItem {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static find(filter = {}) {
    const promise = Promise.resolve().then(async () => {
      if (filter.jobId && typeof filter.jobId === 'string') {
        const data = await readFirebase(`review_required_items/${filter.jobId}`) || {};
        const items = Object.values(data).map(i => new ReviewRequiredItem(i));
        return items.filter(i => matchFilter(i, filter));
      }
      
      const all = await readFirebase('review_required_items') || {};
      const items = [];
      for (const jId of Object.keys(all)) {
        for (const itemId of Object.keys(all[jId])) {
          items.push(new ReviewRequiredItem(all[jId][itemId]));
        }
      }
      return items.filter(i => matchFilter(i, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await ReviewRequiredItem.find(filter);
    return list.length;
  }

  static findOne(filter = {}) {
    const promise = ReviewRequiredItem.find(filter).then(list => list);
    return new QueryChain(promise, true);
  }

  static async deleteMany(filter = {}) {
    const list = await ReviewRequiredItem.find(filter);
    for (const item of list) {
      await writeFirebase(`review_required_items/${item.jobId}/${item._id}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  static async create(payload) {
    const itemId = payload._id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const item = new ReviewRequiredItem({
      _id: itemId,
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
      severity: payload.severity || 'medium'
    });
    await writeFirebase(`review_required_items/${payload.jobId}/${itemId}`, item);
    return item;
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await ReviewRequiredItem.create(item);
      results.push(created);
    }
    return results;
  }
}

module.exports = ReviewRequiredItem;
module.exports.SEVERITIES = SEVERITIES;
