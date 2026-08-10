const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'prWorkerService.js'),
  'utf8'
);

assert.match(
  source,
  /buildCancellationSummary[\s\S]*buildAndSaveSummary\(\{[\s\S]*discoverReconciliation:\s*false[\s\S]*\}\)/,
  'cancellation summary builder must explicitly bypass strict reconciliation discovery'
);

assert.match(
  source,
  /if \(runnerResult\.cancelled\)[\s\S]*buildCancellationSummary\(jobId, filteringResult, partialCollection\)/,
  'runner cancellation path must use the cancellation summary builder'
);

assert.match(
  source,
  /if \(workerStateService\.isCancellationRequested\(jobId\)\)[\s\S]*buildCancellationSummary\(jobId, filteringResult, outputCollection\)[\s\S]*return;[\s\S]*const summary = await buildAndSaveSummary/,
  'post-collection cancellation must be checked before strict completion discovery'
);

console.log('Issue 88 cancellation reconciliation bypass regression test passed.');
