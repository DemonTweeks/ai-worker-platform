<template>
  <section class="panel">
    <div class="section-title-row">
      <h2>Output Files</h2>
      <a
        v-if="canDownloadZip"
        class="download-button"
        :href="zipUrl"
      >
        Download ZIP
      </a>
    </div>
    <div v-if="outputs.length === 0" class="empty-state">No output files are tracked for this job.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Size</th>
            <th>Retention</th>
            <th>Status</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in outputs" :key="file.id">
            <td>{{ fileTypeLabel(file.fileType) }}</td>
            <td>{{ file.fileName }}</td>
            <td>{{ formatBytes(file.fileSize) }}</td>
            <td>{{ formatDateTime(file.retentionUntil) }}</td>
            <td>{{ availabilityText(file) }}</td>
            <td>
              <a
                v-if="file.available"
                class="table-link"
                :href="downloadUrl(file)"
              >
                Download
              </a>
              <span v-else class="muted">Unavailable</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { getFileDownloadUrl, getZipDownloadUrl } from '../../api/jobApi';
import { formatBytes, formatDateTime } from '../../utils/formatUtils';

const FILE_TYPE_LABELS = {
  ecc_output: 'ECC Output',
  review_required_report: 'Review Required Report',
  warning_report: 'Error / Warning Report',
  summary: 'Summary JSON',
  zip_package: 'ZIP Package'
};

export default {
  name: 'JobDetailFiles',
  props: {
    jobId: { type: String, required: true },
    outputs: { type: Array, default: () => [] }
  },
  computed: {
    canDownloadZip() {
      return this.outputs.some((file) => file.fileType === 'zip_package' && file.available);
    },
    zipUrl() {
      return getZipDownloadUrl(this.jobId);
    }
  },
  methods: {
    formatBytes,
    formatDateTime,
    availabilityText(file) {
      if (file.expired) return 'File Expired';
      if (!file.exists) return 'Missing';
      return file.available ? 'Available' : 'Unavailable';
    },
    downloadUrl(file) {
      return getFileDownloadUrl(this.jobId, file.id);
    },
    fileTypeLabel(fileType) {
      return FILE_TYPE_LABELS[fileType] || fileType || 'Output';
    }
  }
};
</script>
