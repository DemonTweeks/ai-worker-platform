/* Offline acceptance: ephemeral loopback HTTP, in-memory DB, no live services/accounts. */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
const runtime = path.resolve(__dirname, '../../command-center/runtime');
fs.mkdirSync(runtime, { recursive: true });
const storage = fs.mkdtempSync(path.join(runtime, 'tx-bom-acceptance-'));
process.env.STORAGE_ROOT = storage;
const queue = require('../src/queue/jobQueue');
const originalEnqueue = queue.enqueueJob;
// Deterministic queued-only cancellation tests; real generic runner is invoked explicitly below.
queue.enqueueJob = async (jobId) => ({ queuedJobIds: [jobId], activeJobIds: [], queuedCount: 1, activeCount: 0 });
const { Job, JobFile } = require('../src/models');
const { runGenericSkillJob, executeProcess } = require('../src/skills/genericSkillRunner');
const { loadApprovedSkill } = require('../src/skills/skillPackageService');
const { getPythonExecutable } = require('../src/services/childProcessRunner');
const app = require('../src/app');
const skillRoot = path.resolve(__dirname, '../../skills/tx-bom-generator');
const skill = loadApprovedSkill('tx-bom-generator');
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const python = (code, args = []) => {
  const result = spawnSync(getPythonExecutable(), ['-c', code, ...args], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
  assert.strictEqual(result.status, 0, result.stderr);
};
const fixtures = path.join(storage, 'synthetic-fixtures');
fs.mkdirSync(fixtures);
python(`import sys\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom test_adapter import make_job\nfor site in ['ISOLATION_A','ISOLATION_B','LEGACY_HEADER']:\n root=Path(sys.argv[2])/site\n root.mkdir()\n def configure(wb,req):
  if site=='LEGACY_HEADER': wb['TX BOM template']['A1']='=COUNTA(#REF!)'
 make_job(root,selection=site,records=[{'site_id':site}],modifier=configure)`, [path.join(skillRoot, 'tests'), fixtures]);
const request = async (base, site, key, selection = site) => {
  const form = new FormData();
  form.append('browserTabSessionId', `tx-bom-tab-${key}`);
  form.append('idempotencyKey', `tx-bom-${key}`);
  form.append('parameters', JSON.stringify({ siteIds: selection }));
  for (const name of ['epms', 'config']) form.append(name, new Blob([fs.readFileSync(path.join(fixtures, site, `input/${name}.xlsx`))]), `${name}.xlsx`);
  const response = await fetch(`${base}/api/skills/tx-bom-generator/jobs`, { method: 'POST', body: form });
  assert.strictEqual(response.status, 201, await response.clone().text());
  return (await response.json()).job;
};
const run = async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const catalog = await (await fetch(`${base}/api/skills`)).json();
    const manifest = catalog.skills.find((s) => s.skillId === 'tx-bom-generator');
    assert.deepStrictEqual(manifest.inputs.files.map((x) => x.name), ['epms', 'config']);
    assert.strictEqual(manifest.execution.supportsCancellation, false);
    assert.strictEqual(manifest.ui.parameters.siteIds.control, 'textarea');
    const missing = new FormData(); missing.append('parameters', JSON.stringify({ siteIds:'ISOLATION_A' }));
    const missingResponse = await fetch(`${base}/api/skills/tx-bom-generator/jobs`, { method:'POST',body:missing });
    assert.strictEqual(missingResponse.status,400);
    // Two true concurrent Python subprocess jobs; no parallel agents.
    const a = await request(base, 'ISOLATION_A', 'isolation-a');
    const b = await request(base, 'ISOLATION_B', 'isolation-b');
    const runs = await Promise.all([runGenericSkillJob(a.jobId), runGenericSkillJob(b.jobId)]);
    for (const [index, runResult] of runs.entries()) {
      assert.strictEqual(runResult.job.status,'completed',JSON.stringify(runResult.job.error));
      assert.strictEqual(runResult.processResult.exitCode,0);
      const own = index === 0 ? 'ISOLATION_A':'ISOLATION_B';
      const other = index === 0 ? 'ISOLATION_B':'ISOLATION_A';
      const result = runResult.result;
      assert.strictEqual(result.reconciliation.requestedCount,1);
      assert.strictEqual(result.reconciliation.generatedCount,1);
      assert.strictEqual(result.reconciliation.unaccountedCount,0);
      const files = await JobFile.find({jobId:runResult.job.jobId}).lean();
      const outputs = files.filter((f) => ['skill_output','zip_package'].includes(f.fileType));
      assert.strictEqual(outputs.length,3);
      for (const f of outputs) {
        const response = await fetch(`${base}/api/jobs/${runResult.job.jobId}/download/${f._id}`);
        assert.strictEqual(response.status,200);const data=Buffer.from(await response.arrayBuffer());
        assert.strictEqual(sha(data),f.sha256);
        if(f.mediaType==='application/json') {
          const report=JSON.parse(data);assert.strictEqual(report.sites[0].siteId,own);
          assert(!data.toString().includes(other));assert(!data.toString().includes(storage));
        }
      }
      const zipResponse=await fetch(`${base}/api/jobs/${runResult.job.jobId}/download-zip`);
      assert.strictEqual(zipResponse.status,200);
      const zip=Buffer.from(await zipResponse.arrayBuffer());assert.strictEqual(zip.readUInt32LE(0),0x04034b50);
      python(`import sys,zipfile,json\nimport openpyxl\nfrom pathlib import Path\nr=Path(sys.argv[1]);result=json.loads((r/'result.json').read_text());p=next(x['path'] for x in result['outputs'] if x['name']=='bom');w=openpyxl.load_workbook(r/p);assert w['TX BOM template']['C4'].value==sys.argv[2];w.close()\nwith zipfile.ZipFile(r/'output/TX_BOM_DELIVERY.zip') as z: assert sorted(z.namelist())==['BOM.xlsx','processing-report.json']`,[path.dirname(path.join(storage,runResult.job.inputManifestPath)),own]);
    }
    const filesA=await JobFile.find({jobId:a.jobId,fileType:'skill_output'}).lean();
    const cross=await fetch(`${base}/api/jobs/${b.jobId}/download/${filesA[0]._id}`);assert.strictEqual(cross.status,404);
    const history=await (await fetch(`${base}/api/jobs?workerId=tx-bom-generator`)).json();
    assert(history.items.some((j)=>j.jobId===a.jobId));
    const detail=await (await fetch(`${base}/api/jobs/${a.jobId}`)).json();
    assert.strictEqual(detail.job.generatedSiteCount,1);
    assert.strictEqual(manifest.version,'0.1.1');
    const legacy=await request(base,'LEGACY_HEADER','legacy-header');
    const legacyRun=await runGenericSkillJob(legacy.jobId);
    assert.strictEqual(legacyRun.job.status,'completed_with_warning',JSON.stringify(legacyRun.job.error));
    assert.strictEqual(legacyRun.result.reconciliation.generatedCount,1);
    assert(legacyRun.result.warnings.some((w)=>w.code==='LEGACY_TEMPLATE_COUNT_HEADER'));
    const legacyFiles=await JobFile.find({jobId:legacy.jobId}).lean();
    const legacyBom=legacyFiles.find((f)=>f.mediaType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert(legacyBom);
    const legacyResponse=await fetch(`${base}/api/jobs/${legacy.jobId}/download/${legacyBom._id}`);
    assert.strictEqual(legacyResponse.status,200);
    assert.strictEqual(sha(Buffer.from(await legacyResponse.arrayBuffer())),legacyBom.sha256);
    python(`import sys,json,openpyxl\nfrom pathlib import Path\nr=Path(sys.argv[1]);result=json.loads((r/'result.json').read_text());p=next(x['path'] for x in result['outputs'] if x['name']=='bom');w=openpyxl.load_workbook(r/p,data_only=False);assert w['TX BOM template']['A1'].value=='=COUNTA(#REF!)';assert w['TX BOM template']['C4'].value=='LEGACY_HEADER';w.close()`,[path.dirname(path.join(storage,legacyRun.job.inputManifestPath))]);
    const mixed=await request(base,'ISOLATION_A','mixed','ISOLATION_A;MISSING');
    const mixedRun=await runGenericSkillJob(mixed.jobId);assert.strictEqual(mixedRun.job.status,'completed_with_warning');
    const failed=await request(base,'ISOLATION_A','all-fail','MISSING');
    const failedRun=await runGenericSkillJob(failed.jobId);assert.strictEqual(failedRun.job.status,'failed');
    assert.deepStrictEqual(failedRun.result.outputs.map((x)=>x.name),['processing_report','delivery']);
    // Actual queue cancellation logic rejects claimed work but permits unclaimed queued work.
    const queued=await request(base,'ISOLATION_A','queued-cancel');
    const cancelled=await fetch(`${base}/api/jobs/${queued.jobId}/cancel`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.strictEqual(cancelled.status,200,await cancelled.clone().text());
    assert.strictEqual((await cancelled.json()).job.status,'cancelled');
    assert(!fs.existsSync(path.join(storage,path.dirname(queued.inputManifestPath),'result.json')));
    const claimed=await request(base,'ISOLATION_A','claimed-cancel');
    const claimedJob=await Job.findOne({jobId:claimed.jobId});
    claimedJob.status='generating';claimedJob.queueRuntime={...(claimedJob.queueRuntime||{}),queueState:'claimed',claimedBy:'offline-test-owner',leaseExpiresAt:new Date(Date.now()+60000).toISOString()};await claimedJob.save();
    const claimedResponse=await fetch(`${base}/api/jobs/${claimed.jobId}/cancel`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.strictEqual(claimedResponse.status,409,await claimedResponse.clone().text());
    assert.strictEqual((await claimedResponse.json()).error.code,'SKILL_CANCELLATION_UNSUPPORTED');
    // Test the existing generic hard-timeout mechanism with a test-only sleeper, never mutate approved runtime.
    const timeoutRoot=path.join(storage,'timeout-probe');fs.mkdirSync(timeoutRoot);
    const sleeper=path.join(timeoutRoot,'sleeper.py');fs.writeFileSync(sleeper,'import time\ntime.sleep(10)\n');
    const timeoutResult=await executeProcess({jobId:'TX-BOM-TIMEOUT',skill:{entrypoint:sleeper,manifest:{execution:{timeoutSeconds:0.1}}},inputManifest:path.join(timeoutRoot,'input.json'),workspace:timeoutRoot,cancellationPath:path.join(timeoutRoot,'cancel.requested')});
    assert.strictEqual(timeoutResult.timedOut,true);assert(!fs.existsSync(path.join(timeoutRoot,'result.json')));
    const after=loadApprovedSkill('tx-bom-generator');assert.strictEqual(after.packageSha256,skill.packageSha256);
    const summary={ok:true,storage,concurrentJobs:[a.jobId,b.jobId],mixedJob:mixed.jobId,allFailedJob:failed.jobId,queuedCancellation:true,claimedCancellationRejected:true,timeout:true,downloads:true,crossJobAccessRejected:true,packageSha256:after.packageSha256};
    fs.writeFileSync(path.join(storage,'acceptance-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
  } finally {
    queue.enqueueJob=originalEnqueue;
    await queue.shutdownQueue();
    await new Promise((resolve)=>server.close(resolve));
    // Retain all synthetic workspaces/artifacts for inspection; DB is in-memory only.
  }
};
run().catch((error)=>{console.error(error);process.exitCode=1;});
