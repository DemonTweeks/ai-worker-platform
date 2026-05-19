<template>
  <section class="panel">
    <h2>Downloads</h2>
    <div v-if="!jobId" class="empty-state">No job selected.</div>
    <div v-else>
      <p class="muted">{{ outputCount }} output file(s) tracked.</p>
      <a
        v-if="canDownload"
        class="download-button"
        :href="downloadUrl"
      >
        Download ZIP
      </a>
      <p v-else class="muted">ZIP is not available yet.</p>
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
    downloadUrl() {
      return this.jobId ? getZipDownloadUrl(this.jobId) : '#';
    }
  }
};
</script>
