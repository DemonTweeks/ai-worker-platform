const config = require('../config/env');
let sqlite;
const getSqlite = () => {
  if (config.dbProvider !== 'sqlite') throw new Error('This operation requires the SQLite provider.');
  if (!sqlite) sqlite = new (require('./sqliteStore').SqliteStore)(config.sqliteDbPath);
  return sqlite;
};
const firebase = () => require('./firebaseRestClient');
const read = async (path) => config.dbProvider === 'sqlite' ? getSqlite().read(path) : firebase().readFirebase(path);
const patch = async (path,value) => config.dbProvider === 'sqlite' ? getSqlite().write(path,value,true) : firebase().writeFirebase(path,value);
const replace = async (path,value) => config.dbProvider === 'sqlite' ? getSqlite().write(path,value) : firebase().replaceFirebase(path,value);
const push = async (path,value) => config.dbProvider === 'sqlite' ? getSqlite().push(path,value) : firebase().pushFirebase(path,value);
const transaction = async (path,updater,options) => config.dbProvider === 'sqlite' ? getSqlite().transact(path,updater,options) : firebase().transactionFirebase(path,updater,options);
const close = () => { if(sqlite){sqlite.close();sqlite=undefined;} };
module.exports = {read,patch,replace,push,transaction,getSqlite,close};
