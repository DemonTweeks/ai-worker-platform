const express = require('express');
const { getMongoStatus } = require('../db/mongo');
const { getStorageStatus } = require('../services/storageService');
const { getWebSocketStatus } = require('../websocket/server');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-worker-platform-backend',
    timestamp: new Date().toISOString(),
    mongo: getMongoStatus(),
    storage: getStorageStatus(),
    websocket: getWebSocketStatus()
  });
});

module.exports = router;
