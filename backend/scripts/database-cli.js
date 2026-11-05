// Local offline migration/backup CLI. Never reads Firebase or starts a queue.
const fs=require('fs');
const path=require('path');
const {SqliteStore}=require('../src/db/sqliteStore');
const tree=require('../src/db/jsonTree');
const args=process.argv.slice(2);
const [command,filename,other]=args;
const fail=message=>{throw new Error(message);};
let db;
try {
  if(!filename||!['init','info','backup','import-fresh','export-offline'].includes(command)) fail('Usage: node scripts/database-cli.js init|info <db> ; backup <db> <destination> ; import-fresh <new-db> <private-json> ; export-offline <db> <new-private-json>. Stop writers for imports/restores and matching file-storage snapshots.');
  if(command==='init') { db=SqliteStore.initialize(filename); console.log(JSON.stringify(db.info())); }
  if(command==='info') {db=new SqliteStore(filename);console.log(JSON.stringify(db.info()));}
  if(command==='backup') {if(!other)fail('Backup destination required.');db=new SqliteStore(filename);console.log(JSON.stringify({backup:db.backup(other)}));}
  if(command==='export-offline') {
    if(!other)fail('New private export path required.');db=new SqliteStore(filename);
    const payload={format:'platform-private-migration',schemaVersion:1,exportedAt:new Date().toISOString(),collections:db.read('')||{}};
    fs.writeFileSync(other,JSON.stringify(payload,null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({file:path.resolve(other),warning:'PRIVATE: includes credentials and user data. Protect with filesystem permissions. Copy matching artifact storage separately.'}));
  }
  if(command==='import-fresh') {
    if(!other)fail('Input JSON file required.');
    if(fs.statSync(other).size>100*1024*1024)fail('Import exceeds 100 MiB.');
    const bundle=JSON.parse(fs.readFileSync(other,'utf8'));
    if(bundle.format!=='platform-private-migration'||bundle.schemaVersion!==1||!bundle.collections||typeof bundle.collections!=='object'||Array.isArray(bundle.collections))fail('Expected explicit platform-private-migration schema 1 bundle. Wrap an authorized Firebase snapshot under collections after review.');
    tree.validate(bundle.collections);
    const allowed=['jobs','job_files','warning_items','review_required_items','assets','admin_users','admin_audit_logs','local_settings','admin_data_notes','health'];
    if(Object.keys(bundle.collections).some(k=>!allowed.includes(k)))fail('Unknown collection.');
    const terminal=['completed','completed_with_warning','failed','cancelled','cancelled_with_partial_result'];
    for(const [id,job] of Object.entries(bundle.collections.jobs||{})){
      if(job.jobId!==id||!terminal.includes(job.status))fail(`Job ${id}: ID mismatch or non-terminal job. Drain/reconcile offline before importing; never replay automatically.`);
    }
    for(const [name,value] of Object.entries(bundle.collections)) if(!value || typeof value!=='object' || Array.isArray(value)) fail(`Collection ${name} must be an object.`);
    db=SqliteStore.initialize(filename);
    db.atomic(()=>{for(const [name,value] of Object.entries(bundle.collections)) db.write(name,value);});
    console.log(JSON.stringify({...db.info(),warning:'Metadata imported only. Matching artifact storage, permissions, paths, login and hashes must be verified before starting any runtime.'}));
  }
} catch(error) { console.error(`${error.code||'DATABASE_COMMAND_FAILED'}: ${error.message}`);process.exitCode=1; }
finally {if(db)db.close();}
