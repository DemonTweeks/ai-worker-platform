<template>
  <section class="panel">
    <h2>Downloads</h2>
    <div v-if="!jobId" class="empty-state">No job selected.</div>
    <div v-else>
      <p class="muted">{{ outputCount }} output file(s) tracked for {{ jobId }}.</p>
      <p v-if="canDownload" class="helper-text">ZIP package and file-level downloads should be ready once processing completes.</p>
      <a
        v-if="canDownload"
        class="download-button"
        :href="downloadUrl"
      >
        Download ZIP
      </a>
      <p v-else class="muted">{{ unavailableMessage }}</p>
      <p v-if="!canDownload && jobReady" class="muted">{{ jobReadyMessage }}</p>
    </div>
  </section>
</template>

<script>
import { getZipDownloadUrl } from '../api/jobApi';

export default {
  name: 'DownloadPanel',
  props: {
    jobId: { type: String, default: '' },
    detail: { type: Object, default: null }
  },
  computed: {
    outputCount() {
      return this.detail && this.detail.outputs ? this.detail.outputs.length : 0;
    },
    canDownload() {
      return this.detail && this.detail.outputs && this.detail.outputs.some((file) => file.fileType === 'zip_package' && file.available);
    },
    jobReady() {
      return this.detail && this.detail.job && ['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(this.detail.job.status);
    },
    jobReadyMessage() {
      return this.jobReady ? 'Output delivery is complete for this job.' : '';
    },
    unavailableMessage() {
      const zip = this.detail && this.detail.outputs
        ? this.detail.outputs.find((file) => file.fileType === 'zip_package')
        : null;
      if (zip && zip.expired) return 'ZIP has expired based on retention policy.';
      if (zip && (zip.deletedAt || zip.cleanupReason)) return 'ZIP is unavailable after retention cleanup.';
      return 'ZIP is not available yet.';
    },
    downloadUrl() {
      return this.jobId ? getZipDownloadUrl(this.jobId) : '#';
    }
  }
};
</script>
