const {spawnSync}=require('child_process');
const path=require('path');
for(const name of ['durable-queue-reconciliation-test.js','queue-registry-test.js','job-control-concurrency-test.js','iepms-skill-offline-test.js','generic-skill-live-test.js','generic-ran-skill-live-test.js','tx-bom-skill-offline-test.js','auditor-shared-mw-test.js']) {
  const result=spawnSync(process.execPath,[path.join(__dirname,'sqlite-fixture-runner.js'),name],{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status||1);
}
