const { readFirebase, writeFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

const FILE_TYPES = [
  'uploaded_export',
  'ran_bom_upload',
  'ran_epms_upload',
  'pr_auditor_final_po_upload',
  'pr_auditor_epms_upload',
  'pr_audit_result_xlsx',
  'pr_audit_summary_json',
  'pr_audit_warning_report',
  'filtered_input',
  'ecc_output',
  'ran_ecc_output',
  'ran_ecc_output_with_general_items',
  'ran_pipeline_summary',
  'source_review_required',
  'source_duplicates_skipped',
  'review_required_report',
  'warning_report',
  'summary',
  'zip_package',
  'temp'
];

class JobFile {
  constructor(data) {
    Object.assign(this, data);
  }

  toJSON() {
    return { ...this };
  }

  static async findById(id) {
    // To find by generic ID, we search all files across all jobs in Firebase
    const all = await readFirebase('job_files') || {};
    for (const jobId of Object.keys(all)) {
      if (all[jobId][id]) {
        return new JobFile(all[jobId][id]);
      }
    }
    return null;
  }

  static findOne(filter = {}) {
    const promise = JobFile.find(filter).then(list => list);
    return new QueryChain(promise, true);
  }

  static find(filter = {}) {
    const promise = readFirebase('job_files').then(data => {
      const all = data || {};
      const files = [];
      for (const jobId of Object.keys(all)) {
        for (const fileId of Object.keys(all[jobId])) {
          files.push(new JobFile(all[jobId][fileId]));
        }
      }
      return files.filter(f => matchFilter(f, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await JobFile.find(filter);
    return list.length;
  }

  static async create(payload) {
    const fileId = payload._id || Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const file = new JobFile({
      _id: fileId,
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
      fileAvailable: payload.fileAvailable !== false,
      isExpired: payload.isExpired || false,
      fileSize: payload.fileSize || 0
    });
    await writeFirebase(`job_files/${payload.jobId}/${fileId}`, file);
    return file;
  }

  static async updateOne(filter = {}, update = {}) {
    const file = await JobFile.findOne(filter);
    if (file) {
      const updatedData = { ...file, ...update.$set };
      await writeFirebase(`job_files/${file.jobId}/${file._id}`, updatedData);
      return { nModified: 1, ok: 1 };
    }
    return { nModified: 0, ok: 0 };
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await JobFile.create(item);
      results.push(created);
    }
    return results;
  }

  static async deleteMany(filter = {}) {
    const list = await JobFile.find(filter);
    for (const file of list) {
      await writeFirebase(`job_files/${file.jobId}/${file._id}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  async save() {
    await writeFirebase(`job_files/${this.jobId}/${this._id}`, this);
    return this;
  }
}

module.exports = JobFile;
module.exports.FILE_TYPES = FILE_TYPES;
