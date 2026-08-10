const express = require('express');
const jobService = require('../services/jobService');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) => (
  Promise.resolve(handler(req, res, next)).catch(next)
);

const getRequestedBy = (req) => (
  req.adminUser?.username
  || req.user?.username
  || null
);

router.post('/', asyncHandler(async (req, res) => {
  const result = await jobService.createJob(req.body);
  res.status(result.created === false ? 200 : 201).json(result);
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
  const result = await jobService.cancelJob(req.params.jobId, req.body || {}, {
    requestedBy: getRequestedBy(req)
  });
  res.json(result);
}));

router.post('/:jobId/rerun', asyncHandler(async (req, res) => {
  const result = await jobService.rerunJob(req.params.jobId, req.body || {});
  res.status(201).json(result);
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
