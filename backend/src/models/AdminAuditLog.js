const { readFirebase, writeFirebase, pushFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

class AdminAuditLog {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static find(filter = {}) {
    const promise = readFirebase('admin_audit_logs').then(data => {
      const all = data || {};
      const logs = Object.values(all).map(l => new AdminAuditLog(l));
      return logs.filter(l => matchFilter(l, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await AdminAuditLog.find(filter);
    return list.length;
  }

  static findOne(filter = {}) {
    const promise = AdminAuditLog.find(filter).then(list => list);
    return new QueryChain(promise, true);
  }

  static async deleteMany(filter = {}) {
    const list = await AdminAuditLog.find(filter);
    for (const log of list) {
      await writeFirebase(`admin_audit_logs/${log._id}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await AdminAuditLog.create(item);
      results.push(created);
    }
    return results;
  }

  static async create(payload) {
    const timestamp = payload.timestamp || new Date().toISOString();
    const log = new AdminAuditLog({
      ...payload,
      timestamp
    });
    
    // Push will generate a unique key in RTDB automatically
    const result = await pushFirebase('admin_audit_logs', log);
    log._id = result.name; // Firebase POST returns { name: "-Nxyz..." }
    
    // Save the _id back into the log object
    await writeFirebase(`admin_audit_logs/${result.name}`, { ...log, _id: result.name });
    
    return log;
  }
}

module.exports = AdminAuditLog;
