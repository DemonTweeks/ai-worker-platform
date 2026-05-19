<template>
  <section class="panel">
    <div class="panel-heading">
      <span class="step-marker">4</span>
      <h2>Progress</h2>
    </div>

    <div v-if="jobId" class="job-meta">
      <div>
        <span class="meta-label">Job ID</span>
        <strong>{{ jobId }}</strong>
      </div>
      <div>
        <span class="meta-label">Status</span>
        <strong>{{ status || 'Queued' }}</strong>
      </div>
      <div>
        <span class="meta-label">Scope</span>
        <strong>{{ prScope || 'TSS' }}</strong>
      </div>
      <div>
        <span class="meta-label">Realtime</span>
        <strong>{{ connectionStatus }}</strong>
      </div>
    </div>

    <p class="worker-message">{{ latestMessage }}</p>

    <div v-if="progress" class="progress-grid">
      <span>Processed rows: {{ progress.processedRows || 0 }}</span>
      <span>Total rows: {{ progress.totalRows || 0 }}</span>
    </div>

    <small v-if="updatedAt">Updated: {{ formatDateTime(updatedAt) }}</small>
  </section>
</template>

<script>
import { formatDateTime } from '../utils/formatUtils';

export default {
  name: 'JobProgress',
  props: {
    jobId: { type: String, default: '' },
    prScope: { type: String, default: 'TSS' },
    status: { type: String, default: '' },
    connectionStatus: { type: String, default: 'disconnected' },
    latestMessage: { type: String, default: 'No active job.' },
    progress: { type: Object, default: null },
    updatedAt: { type: String, default: '' }
  },
  methods: {
    formatDateTime
  }
};
</script>
