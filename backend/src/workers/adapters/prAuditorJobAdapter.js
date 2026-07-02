const run = async () => {
  const error = new Error('PR Auditor runtime adapter is not implemented yet.');
  error.code = 'PR_AUDITOR_RUNTIME_NOT_IMPLEMENTED';
  throw error;
};

module.exports = {
  run
};
