const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const prevalidationService = require('../services/prevalidationService');
const jobService = require('../services/jobService');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => (
  Promise.resolve(handler(req, res, next)).catch(next)
);

router.post('/prevalidate', upload.single('file'), asyncHandler(async (req, res) => {
  const result = await prevalidationService.validateUpload(req.file);
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
  res.status(501).json(result);
}));

module.exports = router;
