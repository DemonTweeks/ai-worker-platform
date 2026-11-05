// Backward-compatible helper names; all runtime persistence now selects DB_PROVIDER.
const database = require('./databaseClient');
module.exports = {
  readFirebase: database.read, writeFirebase: database.patch,
  replaceFirebase: database.replace, pushFirebase: database.push,
  transactionFirebase: database.transaction,
  getBaseUrl: () => require('./firebaseRestClient').getBaseUrl()
};
