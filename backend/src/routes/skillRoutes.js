const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const { createSkillJob, listSkillCatalog } = require('../skills/genericSkillJobService');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncHandler(async (_req, res) => {
  res.json(listSkillCatalog());
}));

router.post('/:skillId/jobs', upload.any(), asyncHandler(async (req, res) => {
  const result = await createSkillJob(req.params.skillId, req.body || {}, req.files || []);
  res.status(result.created === false ? 200 : 201).json(result);
}));

module.exports = router;
