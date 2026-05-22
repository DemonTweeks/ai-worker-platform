const { readFirebase, writeFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

class AdminUser {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static async findById(id) {
    // Treat the username or ID as the key
    const all = await readFirebase('admin_users') || {};
    // Find matching ID
    for (const key of Object.keys(all)) {
      if (all[key]._id === id || key === id) {
        return new AdminUser(all[key]);
      }
    }
    return null;
  }

  static findOne(filter = {}) {
    let promise;
    if (filter.username) {
      const usernameKey = String(filter.username).trim().toLowerCase();
      promise = readFirebase(`admin_users/${usernameKey}`).then(data => {
        return data ? [new AdminUser(data)] : [];
      });
    } else {
      promise = AdminUser.find(filter).then(list => list);
    }
    return new QueryChain(promise, true);
  }

  static find(filter = {}) {
    const promise = readFirebase('admin_users').then(data => {
      const all = data || {};
      const users = Object.values(all).map(u => new AdminUser(u));
      return users.filter(u => matchFilter(u, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await AdminUser.find(filter);
    return list.length;
  }

  static async deleteMany(filter = {}) {
    const list = await AdminUser.find(filter);
    for (const user of list) {
      const usernameKey = String(user.username).trim().toLowerCase();
      await writeFirebase(`admin_users/${usernameKey}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await AdminUser.create(item);
      results.push(created);
    }
    return results;
  }

  static async create(payload) {
    const usernameKey = String(payload.username).trim().toLowerCase();
    const userId = payload._id || Math.random().toString(36).substring(2, 15);
    const user = new AdminUser({
      _id: userId,
      ...payload,
      username: usernameKey,
      isActive: payload.isActive !== false,
      createdAt: payload.createdAt || new Date().toISOString()
    });
    await writeFirebase(`admin_users/${usernameKey}`, user);
    return user;
  }

  async save() {
    const usernameKey = String(this.username).trim().toLowerCase();
    await writeFirebase(`admin_users/${usernameKey}`, this);
    return this;
  }
}

module.exports = AdminUser;
