class ApiError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const createApiError = (statusCode, code, message, details = {}) => (
  new ApiError(statusCode, code, message, details)
);

module.exports = {
  ApiError,
  createApiError
};
