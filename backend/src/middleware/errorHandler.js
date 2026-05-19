const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal Server Error';
  let details = err.details || {};

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the configured size limit.'
      : 'Uploaded file could not be processed.';
    details = { field: err.field };
  }

  if (statusCode >= 500) {
    console.error(`${code}: ${message}`);
  }

  return res.status(statusCode).json({
    error: {
      code,
      message,
      details
    }
  });
};

module.exports = errorHandler;
