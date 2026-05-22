const { readFirebase, writeFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

class WarningItem {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static find(filter = {}) {
    const promise = Promise.resolve().then(async () => {
      if (filter.jobId && typeof filter.jobId === 'string') {
        const data = await readFirebase(`warning_items/${filter.jobId}`) || {};
        const items = Object.values(data).map(i => new WarningItem(i));
        return items.filter(i => matchFilter(i, filter));
      }
      
      const all = await readFirebase('warning_items') || {};
      const items = [];
      for (const jId of Object.keys(all)) {
        for (const itemId of Object.keys(all[jId])) {
          items.push(new WarningItem(all[jId][itemId]));
        }
      }
      return items.filter(i => matchFilter(i, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await WarningItem.find(filter);
    return list.length;
  }

  static findOne(filter = {}) {
    const promise = WarningItem.find(filter).then(list => list);
    return new QueryChain(promise, true);
  }

  static async deleteMany(filter = {}) {
    const list = await WarningItem.find(filter);
    for (const item of list) {
      await writeFirebase(`warning_items/${item.jobId}/${item._id}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  static async create(payload) {
    const itemId = payload._id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const item = new WarningItem({
      _id: itemId,
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString()
    });
    await writeFirebase(`warning_items/${payload.jobId}/${itemId}`, item);
    return item;
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await WarningItem.create(item);
      results.push(created);
    }
    return results;
  }
}

module.exports = WarningItem;
