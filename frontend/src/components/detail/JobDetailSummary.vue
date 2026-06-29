<template>
  <section class="panel">
    <h2>Job Summary</h2>
    <div class="detail-grid">
      <span><small>Status</small><strong>{{ statusLabel(job.status) }}</strong></span>
      <span><small>Worker</small><strong>{{ job.workerDisplayName || job.workerType || 'pr-worker' }}</strong></span>
      <span><small>Worker ID</small><strong>{{ job.workerId || 'mw-pr' }}</strong></span>
      <span><small>PR Scope</small><strong>{{ job.prScope || 'N/A' }}</strong></span>
      <span><small>Run Mode</small><strong>{{ job.runMode || 'N/A' }}</strong></span>
      <span><small>Project</small><strong>{{ job.selectedProject || 'N/A' }}</strong></span>
      <span><small>Engine Version</small><strong>{{ job.engineVersion || 'N/A' }}</strong></span>
      <span><small>Engine Commit</small><strong>{{ job.engineCommit || 'N/A' }}</strong></span>
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
      <span v-if="job.cancellation"><small>Cancelled By</small><strong>{{ job.cancellation.requestedBy || 'User' }}</strong></span>
      <span v-if="job.cancellation"><small>Reason</small><strong>{{ job.cancellation.reasonText || job.cancellation.reasonLabel }}</strong></span>
    </div>
    <p v-if="zeroOutputNotice" class="completion-message" :class="zeroOutputTone">{{ zeroOutputNotice }}</p>
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
  computed: {
    zeroOutputNotice() {
      if (!(this.job.matchedSiteCount > 0 && this.job.outputFileCount === 0)) return '';
      if (this.job.status === 'failed') {
        return this.job.error && this.job.error.message
          ? this.job.error.message
          : 'No ECC output was generated.';
      }
      if ((this.job.reviewRequiredCount || 0) > 0 || (this.job.warningCount || 0) > 0) {
        return `No ECC output was generated; review/warning records explain the result.`;
      }
      return 'No ECC output was generated and no review/warning explanation is available.';
    },
    zeroOutputTone() {
      return this.job.status === 'failed' ? 'danger' : 'warning';
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel,
    statusLabel
  }
};
</script>
