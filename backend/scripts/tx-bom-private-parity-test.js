/* Opt-in private baseline acceptance. No business paths, workbooks or site IDs committed.
   Run with TX_BOM_PARITY_EPMS, TX_BOM_PARITY_CONFIG, TX_BOM_PARITY_REFERENCE,
   TX_BOM_PARITY_STORAGE (fresh directory). No production DB/service is used. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawnSync } = require('child_process');
const required = ['EPMS','CONFIG','REFERENCE','STORAGE'];
for (const key of required) assert(process.env[`TX_BOM_PARITY_${key}`], `Set TX_BOM_PARITY_${key}`);
const input = Object.fromEntries(required.map(k=>[k.toLowerCase(),path.resolve(process.env[`TX_BOM_PARITY_${k}`])]));
for (const key of ['epms','config','reference']) assert(fs.statSync(input[key]).isFile());
assert(!fs.existsSync(input.storage),'Use a fresh parity storage directory.');
assert(![input.epms,input.config,input.reference].some(p=>p===input.storage || p.startsWith(input.storage+path.sep)));
fs.mkdirSync(input.storage,{recursive:true});
process.env.AI_WORKER_PROFILE='local';process.env.DB_PROVIDER='firebase';process.env.FIREBASE_DB_MOCK='true';process.env.LLM_ENABLED='false';
process.env.STORAGE_ROOT=input.storage;process.env.RAN_WORKSPACE_ROOT=path.join(input.storage,'ran');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_DEFAULT_PASSWORD=crypto.randomBytes(24).toString('hex');
const queue=require('../src/queue/jobQueue');
queue.enqueueJob=async(jobId)=>({queuedJobIds:[jobId],activeJobIds:[],queuedCount:1,activeCount:0});
const {JobFile}=require('../src/models');
const {runGenericSkillJob}=require('../src/skills/genericSkillRunner');
const {loadApprovedSkill}=require('../src/skills/skillPackageService');
const {getPythonExecutable}=require('../src/services/childProcessRunner');
const app=require('../src/app');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const originalHashes=Object.fromEntries(['epms','config','reference'].map(k=>[k,sha(input[k])]));
const snapshotCode=String.raw`import sys,json,openpyxl
w=openpyxl.load_workbook(sys.argv[1],data_only=False);s=w['TX BOM template'];rows=[]
for r in s.iter_rows(min_row=4,values_only=True):
 if len(r)>2 and r[2]:rows.append({'site':str(r[2]),'metadata':list(r[:5]),'remarks':r[13],'materials':[{'column':c,'code':str(s.cell(2,c).value),'name':s.cell(3,c).value,'quantity':r[c-1]} for c in range(15,len(r)+1) if r[c-1] not in (None,0,'')]})
print(json.dumps({'headers':[[s.cell(r,c).value for c in range(1,s.max_column+1)] for r in range(1,4)],'records':rows},default=str));w.close()`;
const py=(code,args)=>{const r=spawnSync(getPythonExecutable(),['-B','-c',code,...args],{encoding:'utf8',env:{...process.env,PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'}});assert.strictEqual(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const reference=py(snapshotCode,[input.reference]);assert(reference.records.length>0);
const selection=reference.records.map(x=>x.site).join('\n');
const skill=loadApprovedSkill('tx-bom-generator');assert.strictEqual(skill.manifest.version,'0.1.1');
(async()=>{
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const jobs=[];
 try{
  for(let n=1;n<=2;n++){
   const form=new FormData();form.append('browserTabSessionId',`private-parity-${n}`);form.append('idempotencyKey',`private-parity-${n}`);
   form.append('parameters',JSON.stringify({siteIds:selection}));
   for(const k of ['epms','config']) form.append(k,new Blob([fs.readFileSync(input[k])]),`${k}.xlsx`);
   const response=await fetch(`${base}/api/skills/tx-bom-generator/jobs`,{method:'POST',body:form});
   assert.strictEqual(response.status,201,await response.clone().text());jobs.push((await response.json()).job);
  }
  const runs=await Promise.all(jobs.map(j=>runGenericSkillJob(j.jobId)));const snapshots=[];const reports=[];const evidence=[];
  for(const run of runs){
   assert.strictEqual(run.job.status,'completed_with_warning',JSON.stringify(run.job.error));
   assert.strictEqual(run.result.reconciliation.generatedCount,reference.records.length);
   assert.strictEqual(run.result.reconciliation.failedCount,0);
   assert.strictEqual(run.result.reconciliation.unaccountedCount,0);
   assert(run.result.warnings.some(w=>w.code==='LEGACY_TEMPLATE_COUNT_HEADER'));
   const dir=path.join(input.storage,'downloaded',run.job.jobId);fs.mkdirSync(dir,{recursive:true});
   const files=(await JobFile.find({jobId:run.job.jobId}).lean()).filter(f=>['skill_output','zip_package'].includes(f.fileType));assert.strictEqual(files.length,3);
   for(const file of files){
    const response=await fetch(`${base}/api/jobs/${run.job.jobId}/download/${file._id}`);assert.strictEqual(response.status,200);
    const buffer=Buffer.from(await response.arrayBuffer());assert.strictEqual(crypto.createHash('sha256').update(buffer).digest('hex'),file.sha256);
    const filename=file.mediaType==='application/json'?'processing-report.json':file.mediaType==='application/zip'?'TX_BOM_DELIVERY.zip':'BOM.xlsx';fs.writeFileSync(path.join(dir,filename),buffer);
   }
   const report=JSON.parse(fs.readFileSync(path.join(dir,'processing-report.json'),'utf8'));assert.strictEqual(report.inputIntegrity.unchanged,true);reports.push(report.sites);
   const snapshot=py(snapshotCode,[path.join(dir,'BOM.xlsx')]);assert.deepStrictEqual(snapshot,reference);snapshots.push(snapshot);
   const zipCheck=py(String.raw`import sys,zipfile,json
from pathlib import Path
p=Path(sys.argv[1])
with zipfile.ZipFile(p/'TX_BOM_DELIVERY.zip') as z:
 assert sorted(z.namelist())==['BOM.xlsx','processing-report.json']
 assert z.read('BOM.xlsx')==(p/'BOM.xlsx').read_bytes()
 assert z.read('processing-report.json')==(p/'processing-report.json').read_bytes()
print(json.dumps({'zipBytesMatchDownloadedArtifacts':True}))`,[dir]);
   const detail=await(await fetch(`${base}/api/jobs/${run.job.jobId}`)).json();assert.strictEqual(detail.job.generatedSiteCount,reference.records.length);
   evidence.push({jobId:run.job.jobId,status:run.job.status,downloadDirectory:dir,metrics:report.summary.metrics,referenceContentIdentical:true,...zipCheck});
  }
  assert.deepStrictEqual(snapshots[0],snapshots[1]);assert.deepStrictEqual(reports[0],reports[1]);
  for(const k of ['epms','config','reference'])assert.strictEqual(sha(input[k]),originalHashes[k]);
  assert.strictEqual(loadApprovedSkill('tx-bom-generator').packageSha256,skill.packageSha256);
  const summary={ok:true,skillVersion:skill.manifest.version,packageSha256:skill.packageSha256,sourceHashes:originalHashes,repeatContentIdentical:true,repeatSiteReportsIdentical:true,jobs:evidence};
  fs.writeFileSync(path.join(input.storage,'parity-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
 }finally{await queue.shutdownQueue();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
