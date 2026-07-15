const ENGINE_PIN_UNAPPROVED_CODE = 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED';
const ENGINE_PIN_UNAPPROVED_MESSAGE = 'PR Auditor runtime is blocked until a safe engine pin is approved and recorded.';
const ENGINE_PIN_UNAPPROVED_TITLE = 'PR Auditor runtime blocked';

const isEnginePinUnapproved = (error = {}) => error.code === ENGINE_PIN_UNAPPROVED_CODE;

const sanitizePrAuditorError = (error = {}) => {
  if (isEnginePinUnapproved(error)) {
    return {
      code: ENGINE_PIN_UNAPPROVED_CODE,
      message: ENGINE_PIN_UNAPPROVED_MESSAGE,
      details: {}
    };
  }

  return {
    code: error.code || 'WORKER_ERROR',
    message: error.message || 'PR Auditor execution failed.',
    details: error.details || {}
  };
};

module.exports = {
  ENGINE_PIN_UNAPPROVED_CODE,
  ENGINE_PIN_UNAPPROVED_MESSAGE,
  ENGINE_PIN_UNAPPROVED_TITLE,
  isEnginePinUnapproved,
  sanitizePrAuditorError
};
