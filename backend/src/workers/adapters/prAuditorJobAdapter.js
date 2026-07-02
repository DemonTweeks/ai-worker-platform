const { runPrAuditorWorkerJob } = require('../../services/prAuditorWorkerService');

const run = async (jobId) => runPrAuditorWorkerJob(jobId);

module.exports = {
  run
};
