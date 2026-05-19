const express = require('express');
const { getMongoStatus } = require('../db/mongo');
const { getStorageStatus } = require('../services/storageService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-worker-platform-backend',
    timestamp: new Date().toISOString(),
    mongo: getMongoStatus(),
    storage: getStorageStatus()
  });
});

module.exports = router;
