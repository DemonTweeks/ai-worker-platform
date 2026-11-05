// Run unchanged synthetic/offline acceptance scripts against a fresh SQLite provider.
// Only their explicit mock selector is adapted in memory; no worker source is changed.
const fs=require('fs');
const path=require('path');
const Module=require('module');
const name=process.argv[2];
const allowed=['durable-queue-reconciliation-test.js','queue-registry-test.js','job-control-concurrency-test.js','iepms-skill-offline-test.js','generic-skill-live-test.js','generic-ran-skill-live-test.js','tx-bom-skill-offline-test.js','auditor-shared-mw-test.js'];
if(!allowed.includes(name)) throw new Error('Only approved synthetic/offline test scripts may run through this harness.');
const root=fs.mkdtempSync(path.resolve(__dirname,'../../command-center/runtime/sqlite-fixture-'));
process.env.DB_PROVIDER='sqlite';process.env.FIREBASE_DB_MOCK='false';process.env.SQLITE_DB_PATH=path.join(root,'platform.db');
process.env.LLM_ENABLED='false';process.env.STORAGE_ROOT=path.join(root,'storage');process.env.RAN_WORKSPACE_ROOT=path.join(root,'ran');
for(const folder of ['jobs','assets','outputs','temp']) fs.mkdirSync(path.join(process.env.STORAGE_ROOT,folder),{recursive:true});
const {SqliteStore}=require('../src/db/sqliteStore');const initial=SqliteStore.initialize(process.env.SQLITE_DB_PATH);initial.close();
const filename=path.resolve(__dirname,name);
const source=fs.readFileSync(filename,'utf8').replace(/process\.env\.FIREBASE_DB_MOCK\s*=\s*[^;]+;/g,"process.env.FIREBASE_DB_MOCK = 'false';");
// Scripts without a mock override inherit the explicit isolated SQLite environment.
console.log(`SQLite fixture: ${name}; evidence root: ${root}`);
const target=new Module(filename,module);target.filename=filename;target.paths=Module._nodeModulePaths(path.dirname(filename));
// Block all non-loopback HTTP during offline fixtures, including accidental Firebase calls.
const originalFetch=global.fetch;
global.fetch=(url,options)=>{
  const hostname=new URL(typeof url==='string'?url:url.url||url.toString()).hostname;
  if(!['localhost','127.0.0.1','[::1]'].includes(hostname)) throw new Error(`Offline SQLite fixture blocked network host ${hostname}`);
  return originalFetch(url,options);
};
target._compile(source,filename);
process.on('beforeExit',()=>require('../src/db/databaseClient').close());
