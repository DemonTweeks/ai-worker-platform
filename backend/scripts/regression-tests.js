// Deterministic regression profile, independent from the developer's local.env.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const root=fs.mkdtempSync(path.resolve(__dirname,'../../command-center/runtime/persistence-regression-'));
for(const folder of ['jobs','assets','outputs','temp'])fs.mkdirSync(path.join(root,folder),{recursive:true});
const env={...process.env,AI_WORKER_PROFILE:'local',DB_PROVIDER:'firebase',FIREBASE_DB_MOCK:'true',LLM_ENABLED:'false',STORAGE_ROOT:root,RAN_WORKSPACE_ROOT:path.join(root,'ran'),JWT_SECRET:crypto.randomBytes(32).toString('hex'),ADMIN_DEFAULT_PASSWORD:crypto.randomBytes(24).toString('hex')};
for(const file of ['smoke-test.js','llm-provider-test.js','health-status-test.js','engine-integrity-test.js','queue-registry-test.js','durable-queue-reconciliation-test.js','skill-fingerprint-normalization-test.js','generic-skill-contract-test.js','job-control-concurrency-test.js','iepms-skill-offline-test.js','generic-skill-live-test.js','generic-ran-skill-live-test.js','tx-bom-skill-offline-test.js','tx-bom-managed-input-test.js','auditor-shared-mw-test.js','sqlite-test.js','sqlite-worker-tests.js']) {
  console.log(`\n--- ${file} ---`);
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{env,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`Full persistence regression passed. Evidence root: ${root}`);
