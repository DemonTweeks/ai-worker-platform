const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

process.env.FIREBASE_DB_MOCK = 'true';
process.env.LLM_ENABLED = 'false';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iepms-skill-offline-'));
process.env.STORAGE_ROOT = path.join(tempRoot, 'storage');
process.env.IEPMS_PR_UPLOAD_RUNTIME_ROOT = path.join(tempRoot, 'private-runtime');

const queue = require('../src/queue/jobQueue');
queue.enqueueJob = async (jobId) => ({ queuedJobIds: [jobId], activeJobIds: [] });
const { Job } = require('../src/models');
const { createSkillJob } = require('../src/skills/genericSkillJobService');
const { runGenericSkillJob } = require('../src/skills/genericSkillRunner');
const { cancelJob, getJobDetail, getDownloadFile } = require('../src/services/jobService');
const { getPythonExecutable } = require('../src/services/childProcessRunner');

const run = async () => {
  // This deliberately unavailable local CDP endpoint makes live authentication
  // impossible; no corporate iEPMS request can be sent by this regression.
  const cdp = http.createServer((_req, res) => { res.writeHead(503); res.end(); });
  await new Promise((resolve) => cdp.listen(0, '127.0.0.1', resolve));
  process.env.IEPMS_PR_UPLOAD_CDP_PORT = String(cdp.address().port);
  try {
    const eccPath = path.join(tempRoot, 'ECC.xlsx');
    const generated = spawnSync(getPythonExecutable(), ['-c', [
      'import openpyxl,sys',
      'w=openpyxl.Workbook(); s=w.active; s.title="details"',
      's.append(["SN.","Purchasing Area*","Region*","Site ID*","Site Name*","Delivery Unit Code*","Contract Number *","Subcontractor*","PBOM Code*","SOW*","Unit*","Quantity*","Remarks"])',
      's.append([1,"Malaysia_East Malaysia","Sabah","SITE-1","Test site","DU-1","CONTRACT-1","Vendor","PBOM-1","Work","Site",1,""])',
      'w.save(sys.argv[1])'
    ].join('\n'), eccPath], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(generated.status, 0, generated.stderr);
    const ecc = fs.readFileSync(eccPath);
    const created = await createSkillJob('iepms-pr-upload-automation', {
      browserTabSessionId: 'iepms-offline-tab-001',
      idempotencyKey: 'iepms-offline-create-001',
      parameters: JSON.stringify({ projectId: 'c46633e8-6e52-2178-f17e-dcbfdade7cb2', scope: 'TI',
        duModelName: 'TX Mini Project', plannedStartDate: '2026-10-15',
        outsourcedComponentService: 'N', productQualityRectification: 'N' })
    }, [
      { fieldname: 'ecc', originalname: 'ECC.xlsx', size: ecc.length, buffer: ecc }
    ]);
    const claimed = await queue.claimJob(created.job.jobId);
    assert(claimed);
    // A claim is sufficient to block cancellation, even before status changes.
    await assert.rejects(() => cancelJob(created.job.jobId), (error) => error.code === 'SKILL_CANCELLATION_UNSUPPORTED');
    assert.strictEqual((await Job.findOne({ jobId: created.job.jobId })).queueRuntime.cancellationRequested, false);
    await runGenericSkillJob(created.job.jobId);
    const detail = await getJobDetail(created.job.jobId);
    assert.strictEqual(detail.job.status, 'failed');
    assert.strictEqual(detail.job.error.code, 'IEPMS_AUTH_REQUIRED');
    assert(detail.job.failureSummary.includes('Sign in to iEPMS'));
    assert(detail.job.resultFields.some((field) => field.key === 'psq'));
    assert.strictEqual(detail.job.resultSummary.metrics.verified, false);
    assert.strictEqual(detail.job.resultSummary.metrics.submitted, false);
    assert.strictEqual(detail.job.resultSummary.metrics.attachmentSource, 'ecc');
    assert.strictEqual(detail.outputs.length, 2);
    assert(detail.outputs.every((file) => file.available));
    const report = await getDownloadFile(created.job.jobId, detail.outputs[0].id);
    assert(fs.existsSync(report.absolutePath));
    assert(!fs.readFileSync(report.absolutePath, 'utf8').includes('resumeRequest'));
    const queued = await Job.create({jobId: 'IEPMS-QUEUED-CANCEL', workerId: 'iepms-pr-upload-automation', workerType: 'skill', status: 'queued'});
    assert.strictEqual((await cancelJob(queued.jobId)).job.status, 'cancelled');
    console.log('iEPMS offline submit-to-Python, auth failure, safe report download, and cancellation-contract checks passed.');
  } finally {
    await new Promise((resolve) => cdp.close(resolve));
    await queue.shutdownQueue();
    // Only the exact test-owned directory allocated above is removed.
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
