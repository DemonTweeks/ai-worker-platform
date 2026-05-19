<template>
  <article class="job-card">
    <div class="job-card-header">
      <div>
        <p class="eyebrow">{{ job.workerType || 'PR Worker' }}</p>
        <h2>{{ job.jobId }}</h2>
      </div>
      <div class="badge-row">
        <JobStatusBadge :status="job.status" />
        <JobScopeBadge :scope="job.prScope" />
      </div>
    </div>

    <div class="job-card-grid">
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
      <small>Completed: {{ formatDateTime(job.completedAt) }}</small>
    </div>

    <div class="card-actions">
      <router-link class="download-button" :to="{ name: 'job-detail', params: { jobId: job.jobId } }">
        View Detail
      </router-link>
      <a
        v-if="job.outputFileCount > 0"
        class="secondary-link"
        :href="zipUrl"
      >
        Download ZIP
      </a>
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
    zipUrl() {
      return getZipDownloadUrl(this.job.jobId);
    },
    summaryPreview() {
      const text = this.job.finalWorkerSummary || 'Final worker summary is not available yet.';
      return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel
  }
};
</script>
