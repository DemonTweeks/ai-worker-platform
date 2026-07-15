<template>
  <section class="panel">
    <h2>Final Summary</h2>
    <div v-if="!detail" class="empty-state">No final summary yet. Create and run a Job to populate this section.</div>
    <div v-else>
      <div class="summary-grid">
        <template v-if="isPrAuditorJob">
          <span>Status: <strong>{{ detail.job.status || 'Queued' }}</strong></span>
          <span>Audit Report: <strong>{{ detail.job.outputFileCount || 0 }}</strong></span>
          <span>Warnings: <strong>{{ detail.job.warningCount || 0 }}</strong></span>
          <span>Review Required: <strong>{{ detail.job.reviewRequiredCount || 0 }}</strong></span>
          <span v-if="auditSummary">Normal: <strong>{{ auditSummary.normalCount }}</strong></span>
          <span v-if="auditSummary">Invalid PO: <strong>{{ auditSummary.invalidPoCount }}</strong></span>
          <span v-if="auditSummary">Wrong PO: <strong>{{ auditSummary.wrongPoCount }}</strong></span>
          <span v-if="auditSummary">Duplicate PO: <strong>{{ auditSummary.duplicatePoCount }}</strong></span>
        </template>
        <template v-else>
          <span>Status: <strong>{{ detail.job.status || 'Queued' }}</strong></span>
          <span>Scope: <strong>{{ detail.job.prScope || 'TSS' }}</strong></span>
          <span>Requested Sites: <strong>{{ detail.job.requestedSiteCount || 0 }}</strong></span>
          <span>Matched Sites: <strong>{{ detail.job.matchedSiteCount || 0 }}</strong></span>
          <span>Unmatched Sites: <strong>{{ detail.job.unmatchedSiteCount || 0 }}</strong></span>
          <span>Outputs: <strong>{{ detail.job.outputFileCount || 0 }}</strong></span>
          <span>Warnings: <strong>{{ detail.job.warningCount || 0 }}</strong></span>
          <span>Review Required: <strong>{{ detail.job.reviewRequiredCount || 0 }}</strong></span>
        </template>
      </div>
      <template v-if="hasFinalSummary">
        <div class="section-subtitle">AI Explanation</div>
        <pre class="summary-text">{{ finalSummaryText }}</pre>
      </template>
      <p v-else-if="!isTerminal" class="muted">Final summary will appear when the worker reaches a terminal result.</p>
      <p v-else class="muted">Final summary is not available.</p>
      <p v-if="detail.job.error && detail.job.error.message" class="error-text">{{ detail.job.error.message }}</p>
    </div>
  </section>
</template>

<script>
import { isTerminalStatus } from '../utils/statusUtils';
import { prAuditorReportMessage } from '../utils/prAuditorResultUtils';

export default {
  name: 'FinalSummary',
  props: {
    detail: { type: Object, default: null }
  },
  computed: {
    isPrAuditorJob() {
      return this.detail && this.detail.job && this.detail.job.workerId === 'pr-auditor';
    },
    auditSummary() {
      return this.detail && this.detail.job ? (this.detail.job.auditSummary || null) : null;
    },
    finalSummaryText() {
      if (!this.detail || !this.detail.job) return '';
      if (this.isPrAuditorJob) {
        const reportMessage = prAuditorReportMessage(this.detail.job, this.detail.outputs || []);
        const persistedSummary = this.detail.finalWorkerSummary || this.detail.job.finalWorkerSummary || '';
        if (reportMessage.startsWith('No audit report')) return reportMessage;
        return persistedSummary || reportMessage;
      }
      return this.detail.finalWorkerSummary || this.detail.job.finalWorkerSummary || '';
    },
    hasFinalSummary() {
      return this.isTerminal && Boolean(this.finalSummaryText);
    },
    isTerminal() {
      return this.detail && this.detail.job && isTerminalStatus(this.detail.job.status);
    }
  }
};
</script>
