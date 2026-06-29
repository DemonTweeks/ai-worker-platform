export const STATUS_LABELS = {
  queued: 'Queued',
  validating: 'Validating',
  filtering_sites: 'Filtering Sites',
  loading_assets: 'Loading Assets',
  generating: 'Generating',
  exporting: 'Exporting',
  waiting_for_user_input: 'Waiting for User Input',
  cancelling: 'Cancelling',
  completed: 'Completed',
  completed_with_warning: 'Completed with Warning',
  failed: 'Failed',
  cancelled: 'Cancelled',
  cancelled_with_partial_result: 'Cancelled with Partial Result'
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || 'Unknown';

export const generationScopeLabel = (scope) => {
  if (scope === 'all_sites') return 'All sites';
  if (scope === 'site_code') return 'Specific sites';
  return scope || 'Unknown';
};

export const isRunningStatus = (status) => [
  'queued',
  'validating',
  'filtering_sites',
  'loading_assets',
  'generating',
  'exporting',
  'waiting_for_user_input',
  'cancelling'
].includes(String(status || '').toLowerCase());

export const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'success';
  if (value === 'completed_with_warning') return 'warning';
  if (value === 'failed') return 'danger';
  if (value.indexOf('cancelled') === 0) return 'muted';
  if (isRunningStatus(value)) return 'active';
  return 'muted';
};
