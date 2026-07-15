<template>
  <article class="job-card">
    <div class="job-card-header">
      <div>
        <p class="eyebrow">{{ workerEyebrow }}</p>
        <h2>{{ job.jobId }}</h2>
      </div>
      <div class="badge-row">
        <JobStatusBadge :status="job.status" />
        <JobScopeBadge v-if="showScopeBadge" :scope="job.prScope" />
      </div>
    </div>

    <div class="job-card-grid">
      <span v-for="item in metadataItems" :key="item.label"><strong>{{ item.value }}</strong><small>{{ item.label }}</small></span>
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
        :href="downloadUrl"
      >
        {{ downloadLabel }}
      </a>
      <span v-else class="muted">ZIP not ready</span>
    </div>
    <p v-if="job.status === 'cancelled_with_partial_result'" class="muted">Partial cancelled result only. This package is not a completed delivery.</p>
  </article>
</template>

<script>
import { getFileDownloadUrl, getZipDownloadUrl } from '../../api/jobApi';
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel } from '../../utils/jobStatusUtils';
import {
  findAvailableAuditReport,
  hasAuditReport,
  prAuditorReportMessage
} from '../../utils/prAuditorResultUtils';
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
    isPrAuditorJob() {
      return this.job.workerId === 'pr-auditor';
    },
    showScopeBadge() {
      return Boolean(this.job.prScope);
    },
    workerLabel() {
      return this.job.workerDisplayName || this.job.workerId || this.job.workerType || 'PR Worker';
    },
    workerEyebrow() {
      return this.job.workerId ? `${this.workerLabel} • ${this.job.workerId}` : (this.job.workerType || 'PR Worker');
    },
    metadataItems() {
      if (this.isPrAuditorJob) {
        const auditSummary = this.job.auditSummary || null;
        return [
          { label: 'Worker', value: this.workerLabel },
          { label: 'Audit Result', value: this.job.outputFileCount || 0 },
          { label: 'Normal', value: auditSummary ? auditSummary.normalCount : 'N/A' },
          { label: 'Invalid PO', value: auditSummary ? auditSummary.invalidPoCount : 'N/A' },
          { label: 'Wrong PO', value: auditSummary ? auditSummary.wrongPoCount : 'N/A' },
          { label: 'Duplicate PO', value: auditSummary ? auditSummary.duplicatePoCount : 'N/A' },
          { label: 'Review Required', value: this.job.reviewRequiredCount || 0 },
          { label: 'Warnings', value: this.job.warningCount || 0 }
        ];
      }

      return [
        { label: 'Worker', value: this.workerLabel },
        { label: 'Run Mode', value: this.runModeLabel },
        { label: 'Project', value: this.selectedProjectLabel },
        { label: 'Generation', value: generationScopeLabel(this.job.generationScope) },
        { label: 'Requested', value: this.job.requestedSiteCount || 0 },
        { label: 'Matched', value: this.job.matchedSiteCount || 0 },
        { label: 'Unmatched', value: this.job.unmatchedSiteCount || 0 },
        { label: 'Outputs', value: this.job.outputFileCount || 0 },
        { label: 'Review', value: this.job.reviewRequiredCount || 0 },
        { label: 'Warnings', value: this.job.warningCount || 0 }
      ];
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
    auditReportFile() {
      return findAvailableAuditReport(this.job.outputs);
    },
    downloadUrl() {
      if (this.isPrAuditorJob && this.auditReportFile) {
        return getFileDownloadUrl(this.job.jobId, this.auditReportFile.id);
      }

      return this.zipUrl;
    },
    downloadLabel() {
      if (this.isPrAuditorJob) {
        return 'Download Audit Report';
      }

      return this.job.status === 'cancelled_with_partial_result' ? 'Download Partial ZIP' : 'Download ZIP';
    },
    summaryPreview() {
      if (this.isPrAuditorJob) {
        if (!hasAuditReport(this.job, this.job.outputs)) {
          return prAuditorReportMessage(this.job, this.job.outputs);
        }
        const auditSummary = this.job.auditSummary;
        if (auditSummary) {
          return [
            `Normal: ${auditSummary.normalCount}`,
            `Invalid PO: ${auditSummary.invalidPoCount}`,
            `Wrong PO: ${auditSummary.wrongPoCount}`,
            `Duplicate PO: ${auditSummary.duplicatePoCount}`,
            `Review Required: ${auditSummary.reviewRequiredCount}`,
            `Warnings: ${this.job.warningCount || 0}`
          ].join(' • ');
        }
        return this.job.finalWorkerSummary || prAuditorReportMessage(this.job, this.job.outputs);
      }

      if (this.job.status === 'failed') {
        return this.job.failureSummary || 'PR Worker execution failed.';
      }
      const text = this.job.finalWorkerSummary || 'Final worker summary is not available yet.';
      return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    },
    hasDownloadableResult() {
      if (this.isPrAuditorJob) {
        return Boolean(this.auditReportFile);
      }

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
