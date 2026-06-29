<template>
  <article class="job-card">
    <div class="job-card-header">
      <div>
        <p class="eyebrow">{{ workerEyebrow }}</p>
        <h2>{{ job.jobId }}</h2>
      </div>
      <div class="badge-row">
        <JobStatusBadge :status="job.status" />
        <JobScopeBadge :scope="job.prScope" />
      </div>
    </div>

    <div class="job-card-grid">
      <span><strong>{{ workerLabel }}</strong><small>Worker</small></span>
      <span><strong>{{ runModeLabel }}</strong><small>Run Mode</small></span>
      <span><strong>{{ selectedProjectLabel }}</strong><small>Project</small></span>
      <span><strong>{{ generationScopeLabel(job.generationScope) }}</strong><small>Generation</small></span>
      <span><strong>{{ job.requestedSiteCount || 0 }}</strong><small>Requested</small></span>
      <span><strong>{{ job.matchedSiteCount || 0 }}</strong><small>Matched</small></span>
      <span><strong>{{ job.unmatchedSiteCount || 0 }}</strong><small>Unmatched</small></span>
      <span><strong>{{ job.outputFileCount || 0 }}</strong><small>Outputs</small></span>
      <span><strong>{{ job.reviewRequiredCount || 0 }}</strong><small>Review</small></span>
      <span><strong>{{ job.warningCount || 0 }}</strong><small>Warnings</small></span>
    </div>

    <p class="summary-preview">{{ summaryPreview }}</p>

    <div class="job-card-footer">
      <small>Created: {{ formatDateTime(job.createdAt) }}</small>
      <small v-if="job.completedAt">Completed: {{ formatDateTime(job.completedAt) }}</small>
      <small v-else>Completion: In progress</small>
      <small v-if="job.cancellation">Cancelled by user: {{ job.cancellation.reasonText || job.cancellation.reasonLabel }}</small>
    </div>

    <div class="card-actions">
      <router-link class="download-button" :to="{ name: 'job-detail', params: { jobId: job.jobId } }">
        View Detail
      </router-link>
      <a
        v-if="hasDownloadableResult"
        class="secondary-link"
        :href="zipUrl"
      >
        Download ZIP
      </a>
      <span v-else class="muted">ZIP not ready</span>
    </div>
  </article>
</template>

<script>
import { getZipDownloadUrl } from '../../api/jobApi';
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel } from '../../utils/jobStatusUtils';
import JobScopeBadge from './JobScopeBadge.vue';
import JobStatusBadge from './JobStatusBadge.vue';

export default {
  name: 'JobHistoryCard',
  components: {
    JobScopeBadge,
    JobStatusBadge
  },
  props: {
    job: { type: Object, required: true }
  },
  computed: {
    workerLabel() {
      return this.job.workerDisplayName || this.job.workerId || this.job.workerType || 'PR Worker';
    },
    workerEyebrow() {
      return this.job.workerId ? `${this.workerLabel} • ${this.job.workerId}` : (this.job.workerType || 'PR Worker');
    },
    runModeLabel() {
      return this.job.runMode || 'N/A';
    },
    selectedProjectLabel() {
      return this.job.selectedProject || 'N/A';
    },
    zipUrl() {
      return getZipDownloadUrl(this.job.jobId);
    },
    summaryPreview() {
      if (this.job.status === 'failed') {
        return this.job.failureSummary || 'PR Worker execution failed.';
      }
      const text = this.job.finalWorkerSummary || 'Final worker summary is not available yet.';
      return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    },
    hasDownloadableResult() {
      return ['completed', 'completed_with_warning', 'cancelled_with_partial_result'].includes(this.job.status)
        && ((this.job.outputFileCount || 0) > 0 || (this.job.reviewRequiredCount || 0) > 0 || (this.job.warningCount || 0) > 0);
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel
  }
};
</script>
