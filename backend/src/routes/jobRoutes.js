const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const prevalidationService = require('../services/prevalidationService');
const { assertNoActiveScopedJob } = require('../services/jobControlService');
const jobService = require('../services/jobService');
const { listRanProjects } = require('../workers/ranProjectCatalogService');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => (
  Promise.resolve(handler(req, res, next)).catch(next)
);

router.post('/prevalidate', upload.single('file'), asyncHandler(async (req, res) => {
  await assertNoActiveScopedJob({
    workerId: req.body ? req.body.workerId : undefined,
    submissionScopeId: req.body ? req.body.submissionScopeId : undefined
  });
  const result = await prevalidationService.validateUpload(req.file, {
    uploadKind: req.body ? req.body.uploadKind : undefined
  });
  res.status(result.passed ? 200 : 400).json(result);
}));

router.post('/', asyncHandler(async (req, res) => {
  const result = await jobService.createJob(req.body);
  res.status(201).json(result);
}));

router.get('/', asyncHandler(async (req, res) => {
  const result = await jobService.listJobs(req.query);
  res.json(result);
}));

router.get('/ran-projects', asyncHandler(async (_req, res) => {
  res.json({
    projects: listRanProjects()
  });
}));

router.get('/:jobId', asyncHandler(async (req, res) => {
  const result = await jobService.getJobDetail(req.params.jobId);
  res.json(result);
}));

router.post('/:jobId/cancel', asyncHandler(async (req, res) => {
  const result = await jobService.cancelJob(req.params.jobId);
  res.json(result);
}));

router.get('/:jobId/download-zip', asyncHandler(async (req, res) => {
  const result = await jobService.getZipDownloadFile(req.params.jobId);
  res.download(result.absolutePath, result.file.fileName);
}));

router.get('/:jobId/download/:fileId', asyncHandler(async (req, res) => {
  const result = await jobService.getDownloadFile(req.params.jobId, req.params.fileId);
  res.download(result.absolutePath, result.file.fileName);
}));

router.post('/:jobId/ask', asyncHandler(async (req, res) => {
  const result = await jobService.askJob(req.params.jobId, req.body.question);
  res.json(result);
}));

module.exports = router;
