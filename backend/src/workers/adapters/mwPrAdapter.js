const { runPrWorkerJob } = require('../../services/prWorkerService');

const run = async (jobId) => runPrWorkerJob(jobId);

module.exports = {
  run
};
