<template>
  <section class="panel">
    <h2>Job Summary</h2>
    <div class="detail-grid">
      <span v-for="item in summaryItems" :key="item.label"><small>{{ item.label }}</small><strong>{{ item.value }}</strong></span>
    </div>
    <div v-if="isPrAuditorJob && auditSummary" class="detail-grid">
      <span><small>Normal</small><strong>{{ auditSummary.normalCount }}</strong></span>
      <span><small>Invalid PO</small><strong>{{ auditSummary.invalidPoCount }}</strong></span>
      <span><small>Wrong PO</small><strong>{{ auditSummary.wrongPoCount }}</strong></span>
      <span><small>Duplicate PO</small><strong>{{ auditSummary.duplicatePoCount }}</strong></span>
      <span><small>Review Required</small><strong>{{ auditSummary.reviewRequiredCount }}</strong></span>
      <span><small>Warnings</small><strong>{{ auditSummary.warnings.length }}</strong></span>
    </div>
    <p v-else-if="isPrAuditorJob" class="muted">{{ auditSummaryUnavailableMessage }}</p>
    <p v-if="auditReportNotice" class="completion-message" :class="auditReportTone">{{ auditReportNotice }}</p>
    <p v-if="zeroOutputNotice" class="completion-message" :class="zeroOutputTone">{{ zeroOutputNotice }}</p>
    <p v-if="failureMessage" class="error-text">{{ failureMessage }}</p>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';
import { generationScopeLabel, statusLabel } from '../../utils/jobStatusUtils';
import { hasAuditReport, prAuditorReportMessage } from '../../utils/prAuditorResultUtils';

export default {
  name: 'JobDetailSummary',
  props: {
    job: { type: Object, required: true },
    outputs: { type: Array, default: null }
  },
  computed: {
    isPrAuditorJob() {
      return this.job.workerId === 'pr-auditor';
    },
    auditSummary() {
      return this.job.auditSummary || null;
    },
    auditReportAvailable() {
      return hasAuditReport(this.job, this.outputs);
    },
    auditReportNotice() {
      if (!this.isPrAuditorJob) return '';
      return prAuditorReportMessage(this.job, this.outputs);
    },
    auditReportTone() {
      return this.auditReportAvailable ? 'success' : (this.job.status === 'failed' ? 'danger' : 'warning');
    },
    auditSummaryUnavailableMessage() {
      if (!this.auditReportAvailable) return 'Audit Result summary counts are unavailable.';
      return 'Audit Result summary counts are not trusted yet. Detailed findings are available in the workbook download.';
    },
    summaryItems() {
      const common = [
        { label: 'Status', value: statusLabel(this.job.status) },
        { label: 'Worker', value: this.job.workerDisplayName || this.job.workerType || 'pr-worker' },
        { label: 'Worker ID', value: this.job.workerId || 'mw-pr' },
        { label: 'Engine Version', value: this.job.engineVersion || 'N/A' },
        { label: 'Engine Commit', value: this.job.engineCommit || 'N/A' },
        { label: 'Outputs', value: this.job.outputFileCount || 0 },
        { label: 'Review Required', value: this.job.reviewRequiredCount || 0 },
        { label: 'Warnings', value: this.job.warningCount || 0 },
        { label: 'Created', value: formatDateTime(this.job.createdAt) },
        { label: 'Started', value: formatDateTime(this.job.startedAt) },
        { label: 'Completed', value: formatDateTime(this.job.completedAt) },
        { label: 'Cancelled', value: formatDateTime(this.job.cancelledAt) }
      ];

      if (this.job.cancellation) {
        common.push(
          { label: 'Cancelled By', value: this.job.cancellation.requestedBy || 'User' },
          { label: 'Reason', value: this.job.cancellation.reasonText || this.job.cancellation.reasonLabel }
        );
      }

      if (this.isPrAuditorJob) {
        return common;
      }

      return [
        common[0],
        common[1],
        common[2],
        { label: 'PR Scope', value: this.job.prScope || 'N/A' },
        { label: 'Run Mode', value: this.job.runMode || 'N/A' },
        { label: 'Project', value: this.job.selectedProject || 'N/A' },
        common[3],
        common[4],
        { label: 'Generation', value: generationScopeLabel(this.job.generationScope) },
        { label: 'Requested', value: this.job.requestedSiteCount || 0 },
        { label: 'Matched', value: this.job.matchedSiteCount || 0 },
        { label: 'Unmatched', value: this.job.unmatchedSiteCount || 0 },
        ...common.slice(5)
      ];
    },
    zeroOutputNotice() {
      if (this.isPrAuditorJob) return '';
      if (!(this.job.matchedSiteCount > 0 && this.job.outputFileCount === 0)) return '';
      if (this.job.status === 'failed') {
        return this.failureMessage || 'No ECC output was generated.';
      }
      if ((this.job.reviewRequiredCount || 0) > 0 || (this.job.warningCount || 0) > 0) {
        return `No ECC output was generated; review/warning records explain the result.`;
      }
      return 'No ECC output was generated and no review/warning explanation is available.';
    },
    zeroOutputTone() {
      return this.job.status === 'failed' ? 'danger' : 'warning';
    },
    failureMessage() {
      if (this.job.status !== 'failed') return '';
      return this.job.failureSummary || (this.job.error && this.job.error.message ? this.job.error.message : '');
    }
  },
  methods: {
    formatDateTime,
    generationScopeLabel,
    statusLabel
  }
};
</script>
