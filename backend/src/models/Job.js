const { readFirebase, writeFirebase } = require('../db/firebaseClient');
const { QueryChain, matchFilter } = require('./compatibility');

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

class Job {
  constructor(data) {
    Object.assign(this, data);
    if (typeof this.requestedSiteCount === 'undefined') this.requestedSiteCount = null;
    if (typeof this.matchedSiteCount === 'undefined') this.matchedSiteCount = null;
    if (typeof this.unmatchedSiteCount === 'undefined') this.unmatchedSiteCount = null;
    if (typeof this.outputFileCount === 'undefined') this.outputFileCount = null;
    if (typeof this.reviewRequiredCount === 'undefined') this.reviewRequiredCount = null;
    if (typeof this.warningCount === 'undefined') this.warningCount = null;
  }

  toJSON() {
    const obj = { ...this };
    return obj;
  }

  static findOne(filter = {}) {
    let promise;
    if (filter.jobId && typeof filter.jobId === 'string') {
      promise = readFirebase(`jobs/${filter.jobId}`).then(data => {
        return data ? [new Job(data)] : [];
      });
    } else {
      promise = readFirebase('jobs').then(data => {
        const allJobs = data || {};
        const items = Object.values(allJobs).map(j => new Job(j));
        return items.filter(j => matchFilter(j, filter));
      });
    }
    return new QueryChain(promise, true);
  }

  static async create(payload) {
    const job = new Job({
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
      status: payload.status || 'queued',
      workerType: payload.workerType || 'pr-worker',
      requestedSiteCount: payload.requestedSiteCount || 0,
      matchedSiteCount: payload.matchedSiteCount || 0,
      unmatchedSiteCount: payload.unmatchedSiteCount || 0,
      outputFileCount: payload.outputFileCount || 0,
      reviewRequiredCount: payload.reviewRequiredCount || 0,
      warningCount: payload.warningCount || 0,
      finalWorkerSummary: payload.finalWorkerSummary || ''
    });
    await writeFirebase(`jobs/${payload.jobId}`, job);
    return job;
  }

  static find(filter = {}) {
    const promise = readFirebase('jobs').then(data => {
      const allJobs = data || {};
      const items = Object.values(allJobs).map(j => new Job(j));
      return items.filter(j => matchFilter(j, filter));
    });
    return new QueryChain(promise);
  }

  static async countDocuments(filter = {}) {
    const list = await Job.find(filter);
    return list.length;
  }

  static async exists(filter = {}) {
    const item = await Job.findOne(filter);
    return item !== null;
  }

  static async updateOne(filter = {}, update = {}) {
    const job = await Job.findOne(filter);
    if (job) {
      const updatedData = { ...job, ...update.$set };
      await writeFirebase(`jobs/${job.jobId}`, updatedData);
      return { nModified: 1, ok: 1 };
    }
    return { nModified: 0, ok: 0 };
  }

  static async insertMany(arr = []) {
    const results = [];
    for (const item of arr) {
      const created = await Job.create(item);
      results.push(created);
    }
    return results;
  }

  static async deleteMany(filter = {}) {
    const list = await Job.find(filter);
    for (const job of list) {
      await writeFirebase(`jobs/${job.jobId}`, { logicalDeleted: true, deletedAt: new Date().toISOString() });
    }
    return { deletedCount: list.length };
  }

  async save() {
    await writeFirebase(`jobs/${this.jobId}`, this);
    return this;
  }
}

module.exports = Job;
module.exports.JOB_STATUSES = JOB_STATUSES;
module.exports.GENERATION_SCOPES = GENERATION_SCOPES;
module.exports.PR_SCOPES = PR_SCOPES;
