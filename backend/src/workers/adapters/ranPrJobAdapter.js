const { runRanWorkerJob } = require('../../services/ranWorkerService');

const run = async (jobId) => runRanWorkerJob(jobId);

module.exports = {
  run
};
