const multer = require('multer');
const config = require('../config/env');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.limits.maxUploadSizeMb * 1024 * 1024
  }
});

module.exports = {
  upload
};
