/* Real composite Auditor with shared MW; mock DB, synthetic files, no network. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
const runtime = path.resolve(__dirname, '../../command-center/runtime');
fs.mkdirSync(runtime, { recursive: true });
const storage = fs.mkdtempSync(path.join(runtime, 'auditor-shared-'));
process.env.STORAGE_ROOT = storage;
const queue = require('../src/queue/jobQueue');
queue.enqueueJob = async (id) => ({ queuedJobIds: [id], activeJobIds: [] });
const { createSkillJob } = require('../src/skills/genericSkillJobService');
const { runGenericSkillJob } = require('../src/skills/genericSkillRunner');
const { loadApprovedSkill } = require('../src/skills/skillPackageService');
const { getPythonExecutable } = require('../src/services/childProcessRunner');
const { Job } = require('../src/models');
const skill = loadApprovedSkill('tx-pr-auditor');
const mw = loadApprovedSkill('create-pr-cd');
const run = async () => {
 try {
  assert.strictEqual(skill.dependencies.length, 1);
  assert.strictEqual(skill.dependencies[0].packageSha256, mw.packageSha256);
  assert(!skill.runtimeFiles.some((p) => p.startsWith('dependencies/')));
  const config = require('../src/config/env');
  const approvals = require('../src/skills/approvedSkills.json');
  const originalRoot = config.createPrCdRoot;
  const originalApproval = { ...approvals['create-pr-cd'] };
  const fake = path.join(storage, 'fake-mw');
  fs.cpSync(mw.root, fake, { recursive: true, filter: (source) => !['.git','__pycache__'].includes(path.basename(source)) });
  try {
    config.createPrCdRoot = path.join(storage,'missing-mw');
    assert.throws(() => loadApprovedSkill('tx-pr-auditor'));
    config.createPrCdRoot = fake;
    fs.appendFileSync(path.join(fake,'src/main.py'),'\n# tampered\n');
    assert.throws(() => loadApprovedSkill('tx-pr-auditor'), (e) => e.code === 'SKILL_PACKAGE_UNAPPROVED');
    const manifestPath = path.join(fake,'skill.json');
    const changedManifest = JSON.parse(fs.readFileSync(manifestPath));changedManifest.version='9.9.9';
    fs.writeFileSync(manifestPath,JSON.stringify(changedManifest));
    approvals['create-pr-cd'].approvedVersion='9.9.9';
    approvals['create-pr-cd'].approvedPackageSha256=require('../src/skills/skillPackageService').calculatePackageFingerprint(fake,originalApproval.include).sha256;
    assert.throws(() => loadApprovedSkill('tx-pr-auditor'), (e) => e.code === 'SKILL_DEPENDENCY_INCOMPATIBLE');
  } finally {
    config.createPrCdRoot=originalRoot;
    Object.assign(approvals['create-pr-cd'],originalApproval);
  }
  const fixtures = path.join(storage, 'fixtures'); fs.mkdirSync(fixtures);
  const code = 'import sys\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom tests.test_real_shared_integration import write_epms,write_final\nr=Path(sys.argv[2]);write_epms(r/"epms.xlsx");write_final(r/"final.xlsx")';
  const generated = spawnSync(getPythonExecutable(), ['-c', code, skill.root, fixtures], {encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
  assert.strictEqual(generated.status, 0, generated.stderr);
  const upload = () => ['final_po', 'epms'].map((name) => {
    const file = name === 'final_po' ? 'final.xlsx' : 'epms.xlsx'; const buffer = fs.readFileSync(path.join(fixtures,file));
    return {fieldname:name,originalname:file,size:buffer.length,buffer};
  });
  const make = (key) => createSkillJob('tx-pr-auditor',{browserTabSessionId:'shared-'+key,idempotencyKey:'shared-'+key,parameters:JSON.stringify({annotateEcc:true})},upload());
  const created = await make('success');
  const manifest = path.join(storage,'jobs',created.job.jobId,'skill-input.json');
  const envelope = JSON.parse(fs.readFileSync(manifest));
  assert.deepStrictEqual(envelope.dependencies,[{skillId:'create-pr-cd',version:mw.manifest.version,packageSha256:mw.packageSha256}]);
  const execution = await runGenericSkillJob(created.job.jobId);
  assert(!execution.error, execution.error && execution.error.message);
  assert(['completed','completed_with_warning'].includes(execution.job.status),JSON.stringify(execution.result));
  const identity = execution.result.summary.metrics.entitlement;
  assert.strictEqual(identity.dependencyVersion,mw.manifest.version);
  assert.strictEqual(identity.dependencyPackageSha256,mw.packageSha256);
  assert.strictEqual(identity.dependencyCommit,'8fb4fd5bbda0ff1bbcf9b5cac5e339881f17e88e');
  assert.deepStrictEqual(identity.scopes.map((s)=>s.scope),['TSS','TI']);
  assert.deepStrictEqual(execution.result.summary.metrics.classifications,{Normal:1});
  for (const change of ['fingerprint','missing']) {
    const queued = await make(change);
    const input = path.join(storage,'jobs',queued.job.jobId,'skill-input.json');
    const frozen = JSON.parse(fs.readFileSync(input));
    if(change==='missing') delete frozen.dependencies; else frozen.dependencies[0].packageSha256='0'.repeat(64);
    fs.writeFileSync(input,JSON.stringify(frozen));
    const result = await runGenericSkillJob(queued.job.jobId);
    assert.strictEqual(result.error.code,'SKILL_DEPENDENCY_CHANGED');
    assert.strictEqual((await Job.findOne({jobId:queued.job.jobId})).status,'failed');
    assert(!fs.existsSync(path.join(path.dirname(input),'temp','create-pr-cd')));
  }
  console.log(JSON.stringify({ok:true,storage,sharedVersion:identity.dependencyVersion,sharedSha256:identity.dependencyPackageSha256,scopes:identity.scopes.map((s)=>s.scope),changedDependencyBlocked:true}));
 } finally { await queue.shutdownQueue(); }
};
run().catch((error)=>{console.error(error);process.exitCode=1;});
