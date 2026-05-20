<template>
  <section class="panel">
    <div class="panel-heading">
      <span class="step-marker">4</span>
      <h2>Job Progress</h2>
    </div>

    <div v-if="jobId" class="progress-overview">
      <div>
        <span class="meta-label">Job ID</span>
        <strong>{{ jobId }}</strong>
      </div>
      <div>
        <span class="meta-label">Status</span>
        <strong>{{ statusLabel }}</strong>
      </div>
      <div>
        <span class="meta-label">Current phase</span>
        <strong>{{ phaseLabel }}</strong>
      </div>
      <div>
        <span class="meta-label">Result readiness</span>
        <strong>{{ readinessLabel }}</strong>
      </div>
    </div>

    <p v-if="!jobId" class="muted">No active job yet. Finish validation and create a Job to begin tracking.</p>
    <template v-else>
      <p class="worker-message">{{ latestMessage }}</p>
      <div class="progress-track" role="progressbar" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="progressPercent">
        <span :style="{ width: `${progressPercent}%` }" />
      </div>
      <div class="progress-kpis">
        <span>Current phase: <strong>{{ phaseLabel }}</strong></span>
        <span>Total rows: <strong>{{ displayCounts.total }}</strong></span>
        <span>Processed rows: <strong>{{ displayCounts.processed }}</strong></span>
        <span>Failed rows: <strong>{{ displayCounts.failed }}</strong></span>
      </div>
      <p class="muted">Completion: <strong>{{ completionState }}</strong></p>
      <p class="muted connection-text">Connection: {{ connectionStatus }}</p>
      <small v-if="updatedAt">Last update: {{ formatDateTime(updatedAt) }}</small>
      <p v-if="nextAction" class="next-action">{{ nextAction }}</p>
    </template>
  </section>
</template>

<script>
import { formatDateTime } from '../utils/formatUtils';
import { statusLabel } from '../utils/jobStatusUtils';
import { isTerminalStatus } from '../utils/statusUtils';

export default {
  name: 'JobProgress',
  props: {
    jobId: { type: String, default: '' },
    prScope: { type: String, default: 'TSS' },
    status: { type: String, default: '' },
    connectionStatus: { type: String, default: 'disconnected' },
    latestMessage: { type: String, default: 'No active job.' },
    progress: { type: Object, default: null },
    updatedAt: { type: String, default: '' },
    siteCounts: { type: Object, default: () => ({ total: 0, processed: 0, failed: 0 }) },
    events: { type: Array, default: () => [] }
  },
  methods: {
    formatDateTime,
    statusLabel
  },
  computed: {
    statusValue() {
      return this.status || 'queued';
    },
    statusLabel() {
      return statusLabel(this.statusValue);
    },
    displayCounts() {
      return {
        total: Number(this.siteCounts && this.siteCounts.total !== undefined ? this.siteCounts.total : (this.progress && this.progress.totalRows) || 0),
        processed: Number(this.siteCounts && this.siteCounts.processed !== undefined ? this.siteCounts.processed : (this.progress && this.progress.processedRows) || 0),
        failed: Number(this.siteCounts && this.siteCounts.failed !== undefined ? this.siteCounts.failed : (this.progress && this.progress.failedRows) || 0)
      };
    },
    progressPercent() {
      if (!this.displayCounts.total) return 0;
      if (this.displayCounts.processed > this.displayCounts.total) return 100;
      return Math.min(Math.round((this.displayCounts.processed / this.displayCounts.total) * 100), 100);
    },
    phaseLabel() {
      return this.progress && this.progress.currentPhase
        ? this.progress.currentPhase
        : 'Queued';
    },
    completionState() {
      if (!this.jobId) return 'Not started';
      if (isTerminalStatus(this.statusValue)) return 'Complete';
      if (this.statusValue === 'failed') return 'Failed';
      return this.progressPercent >= 100 ? 'Processing finalization' : `${this.progressPercent}%`;
    },
    readinessLabel() {
      if (!this.jobId) return 'Waiting for job creation';
      if (isTerminalStatus(this.statusValue)) return 'Download actions available';
      if (this.statusValue === 'failed') return 'Review failed output and messages';
      return 'Output pending';
    },
    nextAction() {
      if (!this.jobId) return '';
      if (this.statusValue === 'completed' || this.statusValue === 'completed_with_warning') return 'Open Job Detail to review files and AI explanations.';
      if (this.statusValue === 'failed') return 'Open Job Detail for errors and troubleshooting.';
      return 'Keep this panel open to monitor progress or open detail for audit context.';
    }
  }
};
</script>
