const express = require('express');
const { buildHealthResponse } = require('../services/healthService');

const router = express.Router();

router.get('/', async (req, res) => {
  const health = await buildHealthResponse();
  res.status(health.status === 'down' ? 503 : 200).json(health);
});

module.exports = router;
