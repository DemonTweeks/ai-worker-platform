// Isolated managed-input transport acceptance; no production DB/services/assets.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
process.env.AI_WORKER_PROFILE = 'local';
process.env.LLM_ENABLED = 'false';
fs.mkdirSync(path.resolve(__dirname, '../../command-center/runtime'), { recursive: true });
const root = fs.mkdtempSync(path.resolve(__dirname, '../../command-center/runtime/bom-managed-'));
process.env.STORAGE_ROOT = root;
const config = require('../src/config/env');
const approval = require('../src/skills/txBomManagedTemplate.json');
const queue = require('../src/queue/jobQueue');
queue.enqueueJob = async jobId => ({ queuedJobIds: [jobId] });
const { Job, JobFile } = require('../src/models');
const { createSkillJob, listSkillCatalog } = require('../src/skills/genericSkillJobService');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
// Bytes-only transport probes; real XLSX/engine acceptance is covered separately.
const original = Buffer.from('approved-synthetic-template');
config.txBomManagedTemplatePath = path.join(root, 'managed-template.xlsx');
approval.sha256 = sha(original);
const provision = () => fs.writeFileSync(config.txBomManagedTemplatePath, original);
const epms = { fieldname: 'epms', originalname: 'epms.xlsx', size: 4, buffer: Buffer.from('epms') };
const body = key => ({ parameters: { siteIds: 'SITE_A' }, idempotencyKey: `managed-${key}`, browserTabSessionId: 'managed-test-tab' });
const catalog = () => listSkillCatalog().skills.find(s => s.skillId === 'tx-bom-generator');
(async () => {
 try {
  assert.strictEqual(catalog().managedInputs.config.available, false);
  await assert.rejects(createSkillJob('tx-bom-generator', body('missing'), [epms]), e => e.code === 'BOM_TEMPLATE_UNAVAILABLE');
  provision();
  const entry = catalog();
  assert.strictEqual(entry.managedInputs.config.available, true);
  assert(!JSON.stringify(entry).includes(root));
  assert.strictEqual(entry.inputs.files.find(f => f.name === 'config').required, true);
  await assert.rejects(createSkillJob('tx-bom-generator', body('override'), [epms, { ...epms, fieldname: 'config' }]), e => e.code === 'BOM_TEMPLATE_OVERRIDE_FORBIDDEN');
  await assert.rejects(createSkillJob('tx-bom-generator', { ...body('path'), parameters: { siteIds: 'SITE_A', templatePath: 'bad' } }, [epms]), e => e.code === 'PARAMETERS_INVALID');
  const results = await Promise.all(['a', 'b'].map(k => createSkillJob('tx-bom-generator', body(k), [epms])));
  const snapshots = [];
  for (const { job } of results) {
   const manifest = JSON.parse(fs.readFileSync(path.join(root, job.inputManifestPath)));
   assert.strictEqual(manifest.files.length, 2);
   const template = manifest.files.find(f => f.name === 'config');
   assert.strictEqual(template.sha256, sha(original));
   assert.strictEqual(template.provenance.origin, 'platform-managed');
   assert.strictEqual(job.managedInputs[0].revision, approval.revision);
   const frozenPath = path.join(path.dirname(path.join(root, job.inputManifestPath)), template.path);
   assert.deepStrictEqual(fs.readFileSync(frozenPath), original);
   snapshots.push(frozenPath);
   const saved = await JobFile.find({ jobId: job.jobId, inputName: 'config' }).lean();
   assert.strictEqual(saved.length, 1);
   assert.strictEqual(saved[0].provenance.sha256, sha(original));
  }
  assert.notStrictEqual(snapshots[0], snapshots[1]);
  fs.writeFileSync(config.txBomManagedTemplatePath, 'modified');
  assert.strictEqual(catalog().managedInputs.config.available, false);
  await assert.rejects(createSkillJob('tx-bom-generator', body('changed'), [epms]), e => e.code === 'BOM_TEMPLATE_UNAVAILABLE');
  const replay = await createSkillJob('tx-bom-generator', body('a'), [epms]);
  assert.strictEqual(replay.created, false);
  assert.strictEqual(replay.job.jobId, results[0].job.jobId);
  fs.unlinkSync(config.txBomManagedTemplatePath);
  const replayMissing = await createSkillJob('tx-bom-generator', body('a'), [epms]);
  assert.strictEqual(replayMissing.created, false);
  for (const frozen of snapshots) assert.deepStrictEqual(fs.readFileSync(frozen), original);
  const rerun = await require('../src/services/jobService').rerunJob(results[0].job.jobId);
  assert.strictEqual(rerun.created, true);
  const rerunEnvelope = JSON.parse(fs.readFileSync(path.join(root, rerun.job.inputManifestPath)));
  assert.strictEqual(rerunEnvelope.files.find(f => f.name === 'config').sha256, sha(original));
  assert.strictEqual(rerun.job.managedInputs[0].origin, 'platform-managed');
  assert.strictEqual(await Job.countDocuments({ workerId: 'tx-bom-generator' }), 3);
  // Other skills still require their original input declarations.
  await assert.rejects(createSkillJob('create-pr-cd-ran', { parameters: { runMode: 'standard-pr' } }, [epms]), e => e.code === 'INPUT_FILE_REQUIRED');
  const summary = { ok: true, storage: root, overrideRejected: true, missingAndModifiedBlocked: true,
    concurrentSnapshots: true, replayRetainsFrozenInput: true, provenance: true, unrelatedWorkerUnchanged: true };
  fs.writeFileSync(path.join(root, 'managed-input-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
 } finally { await queue.shutdownQueue(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
