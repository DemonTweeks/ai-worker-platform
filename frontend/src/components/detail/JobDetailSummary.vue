<template>
  <section class="panel">
    <h2>Job Summary</h2>
    <div class="detail-grid">
      <span><small>Status</small><strong>{{ statusLabel(job.status) }}</strong></span>
      <span><small>Worker</small><strong>{{ job.workerType || 'pr-worker' }}</strong></span>
      <span><small>PR Scope</small><strong>{{ job.prScope || 'TSS' }}</strong></span>
      <span><small>Generation</small><strong>{{ generationScopeLabel(job.generationScope) }}</strong></span>
      <span><small>Requested</small><strong>{{ job.requestedSiteCount || 0 }}</strong></span>
      <span><small>Matched</small><strong>{{ job.matchedSiteCount || 0 }}</strong></span>
      <span><small>Unmatched</small><strong>{{ job.unmatchedSiteCount || 0 }}</strong></span>
      <span><small>Outputs</small><strong>{{ job.outputFileCount || 0 }}</strong></span>
      <span><small>Review Required</small><strong>{{ job.reviewRequiredCount || 0 }}</strong></span>
      <span><small>Warnings</small><strong>{{ job.warningCount || 0 }}</strong></span>
      <span><small>Created</small><strong>{{ formatDateTime(job.createdAt) }}</strong></span>
      <span><small>Started</small><strong>{{ formatDateTime(job.startedAt) }}</strong></span>
      <span><small>Completed</small><strong>{{ formatDateTime(job.completedAt) }}</strong></span>
      <span><small>Cancelled</small><strong>{{ formatDateTime(job.cancelledAt) }}</strong></span>
    </div>
    <p v-if="job.error && job.error.message" class="error-text">{{ job.error.message }}</p>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel, statusLabel } from '../../utils/jobStatusUtils';

export default {
  name: 'JobDetailSummary',
  props: {
    job: { type: Object, required: true }
  },
  methods: {
    formatDateTime,
    generationScopeLabel,
    statusLabel
  }
};
</script>
