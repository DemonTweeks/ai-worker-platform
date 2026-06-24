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
    <p v-if="zeroOutputNotice" class="completion-message" :class="zeroOutputTone">{{ zeroOutputNotice }}</p>
    <div v-if="errorPresentation" class="job-error-panel">
      <p class="completion-message danger">{{ errorPresentation.summary }}</p>
      <div class="job-error-grid">
        <span><small>Root cause</small><strong>{{ errorPresentation.rootCause }}</strong></span>
        <span v-if="errorPresentation.interpreter"><small>Resolved interpreter</small><strong>{{ errorPresentation.interpreter }}</strong></span>
        <span v-if="errorPresentation.repairCommand" class="job-error-span-full"><small>Recommended fix</small><code>{{ errorPresentation.repairCommand }}</code></span>
      </div>
      <details v-if="errorPresentation.technicalDetails.length" class="job-error-details">
        <summary>Technical details</summary>
        <div class="job-error-technical-grid">
          <span v-for="detail in errorPresentation.technicalDetails" :key="detail.label">
            <small>{{ detail.label }}</small>
            <strong>{{ detail.value }}</strong>
          </span>
        </div>
      </details>
    </div>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel, statusLabel } from '../../utils/jobStatusUtils';
import { getJobErrorPresentation } from '../../utils/jobErrorUtils';

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
    },
    errorPresentation() {
      return getJobErrorPresentation(this.job);
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel,
    statusLabel
  }
};
</script>
