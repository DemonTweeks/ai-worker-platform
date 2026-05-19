export const TERMINAL_STATUSES = [
  'completed',
  'completed_with_warning',
  'failed',
  'cancelled',
  'cancelled_with_partial_result'
];

export const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(String(status || '').toLowerCase());

export const displayMessage = (message = {}) => {
  if (message.aiMessage && message.llmStatus === 'success') {
    return message.aiMessage;
  }
  if (message.message) {
    return message.message;
  }
  return message.event || message.phase || message.status || 'Status updated.';
};
