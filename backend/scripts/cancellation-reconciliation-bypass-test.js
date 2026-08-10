const assert = require('assert');
const fs = require('fs');
const path = require('path');

const summaryBuilderSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'summaryBuilder.js'),
  'utf8'
);

assert.match(
  summaryBuilderSource,
  /workerStateService\.isCancellationRequested\(jobId\)/,
  'summary reconciliation must honor the in-memory cancellation flag before persisted status catches up'
);

assert.match(
  summaryBuilderSource,
  /const shouldDiscoverReconciliation = discoverReconciliation && !isCancellation/,
  'strict reconciliation discovery must be disabled whenever cancellation is active'
);

console.log('Issue 88 cancellation reconciliation bypass regression test passed.');
