const prAuditorAdapter = require('./prAuditorAdapter');

const run = async (jobId, options = {}) => prAuditorAdapter.run(jobId, options);

module.exports = {
  run
};
