<template>
  <article class="job-card">
    <div class="job-card-header">
      <div>
        <p class="eyebrow">{{ workerEyebrow }}</p>
        <h2>{{ job.jobId }}</h2>
      </div>
      <div class="badge-row">
        <JobStatusBadge :status="job.status" :job="job" />
        <JobScopeBadge v-if="showScopeBadge" :scope="job.prScope" />
      </div>
    </div>

    <div class="job-card-grid">
      <span v-for="item in metadataItems" :key="item.label"><strong>{{ item.value }}</strong><small>{{ item.label }}</small></span>
    </div>

    <p v-if="reconciliationPreview" class="summary-preview">{{ reconciliationPreview }}</p>
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
      <span v-else class="muted">Output not available</span>
    </div>
    <p v-if="job.status === 'cancelled_with_partial_result'" class="muted">Partial cancelled result only. This package is not a completed delivery.</p>
    <p v-else-if="isIncompleteResultJob" class="muted">Incomplete result package only. This is not a completed delivery.</p>
  </article>
</template>

<script>
import { getFileDownloadUrl } from '../../api/jobApi';
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel, isIncompleteResult } from '../../utils/jobStatusUtils';
import {
  findAvailableAuditReport,
  findAvailableArchive,
  hasAuditReport,
  isPrAuditorWorker,
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
      return isPrAuditorWorker(this.job.workerId);
    },
    isIncompleteResultJob() {
      return isIncompleteResult(this.job);
    },
    hasReconciliation() {
      return !this.isPrAuditorJob && this.job.generatedSiteCount !== null && this.job.generatedSiteCount !== undefined;
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

      const reconciliation = this.hasReconciliation
        ? [
          { label: 'Generated', value: this.job.generatedSiteCount || 0 },
          { label: 'Accounted', value: this.job.accountedSiteCount || 0 },
          { label: 'Sites Without Confirmed Result', value: this.job.unaccountedSiteCount || 0 }
        ]
        : [];

      return [
        { label: 'Worker', value: this.workerLabel },
        { label: 'Run Mode', value: this.runModeLabel },
        { label: 'Project', value: this.selectedProjectLabel },
        { label: 'Generation', value: generationScopeLabel(this.job.generationScope) },
        { label: 'Requested', value: this.job.requestedSiteCount || 0 },
        { label: 'Matched', value: this.job.matchedSiteCount || 0 },
        { label: 'Unmatched', value: this.job.unmatchedSiteCount || 0 },
        ...reconciliation,
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
    auditReportFile() {
      return findAvailableAuditReport(this.job.outputs);
    },
    archiveFile() {
      return findAvailableArchive(this.job.outputs);
    },
    availableOutputFile() {
      if (this.isPrAuditorJob && this.auditReportFile) return this.auditReportFile;
      if (this.archiveFile) return this.archiveFile;
      return Array.isArray(this.job.outputs)
        ? this.job.outputs.find((file) => file.available) || null
        : null;
    },
    downloadUrl() {
      return this.availableOutputFile
        ? getFileDownloadUrl(this.job.jobId, this.availableOutputFile.id)
        : '';
    },
    downloadLabel() {
      if (this.isPrAuditorJob && this.auditReportFile) {
        return 'Download Audit Report';
      }

      if (this.archiveFile) {
        return this.job.status === 'cancelled_with_partial_result' || this.isIncompleteResultJob
          ? 'Download Partial ZIP'
          : 'Download ZIP';
      }

      return 'Download Output';
    },
    reconciliationPreview() {
      if (!this.hasReconciliation) return '';
      const requested = this.job.requestedSiteCount || 0;
      const generated = this.job.generatedSiteCount || 0;
      const unaccounted = this.job.unaccountedSiteCount || 0;
      if (unaccounted > 0) {
        return `${generated} of ${requested} requested sites generated. ${unaccounted} sites have no confirmed result.`;
      }
      if (this.job.status === 'completed_with_warning') {
        return `Result reconciled: ${generated}/${requested} generated • ${this.job.accountedSiteCount || 0}/${requested} accounted.`;
      }
      return `Result reconciled: ${this.job.accountedSiteCount || 0}/${requested} requested sites accounted.`;
    },
    summaryPreview() {
      if (isIncompleteResult(this.job)) {
        return 'Incomplete Result — review the sites without a confirmed result before using this delivery as complete.';
      }

      if (this.job.status === 'failed') {
        return this.job.failureSummary || 'PR Worker execution failed.';
      }

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

      const text = this.job.finalWorkerSummary || 'Final worker summary is not available yet.';
      return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    },
    hasDownloadableResult() {
      return Boolean(this.availableOutputFile);
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel
  }
};
</script>
