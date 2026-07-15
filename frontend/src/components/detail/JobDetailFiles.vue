<template>
  <section class="panel">
    <div class="section-title-row">
      <h2>Output Files</h2>
      <a
        v-if="primaryDownloadUrl"
        class="download-button"
        :href="primaryDownloadUrl"
      >
        {{ primaryDownloadLabel }}
      </a>
    </div>
    <p v-if="isPartialCancelledResult" class="muted">Partial cancelled result only. This package is not a completed delivery.</p>
    <div v-if="outputs.length === 0" class="empty-state">No output files are tracked for this job.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Size</th>
            <th>Generated At</th>
            <th>Expires At</th>
            <th>Status</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="file in outputs" :key="file.id">
            <td>{{ fileTypeLabel(file.fileType) }}</td>
            <td>{{ file.fileName }}</td>
            <td>{{ formatBytes(file.fileSize) }}</td>
            <td>{{ formatDateTime(file.createdAt) }}</td>
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
              <span v-else class="muted">{{ unavailableText(file) }}</span>
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
  zip_package: 'ZIP Package',
  pr_audit_result_xlsx: 'Audit Report',
  pr_audit_summary_json: 'Audit Summary JSON'
};

export default {
  name: 'JobDetailFiles',
  props: {
    jobId: { type: String, required: true },
    workerId: { type: String, default: '' },
    outputs: { type: Array, default: () => [] },
    status: { type: String, default: '' }
  },
  computed: {
    isPrAuditorJob() {
      return this.workerId === 'pr-auditor';
    },
    canDownloadZip() {
      return this.outputs.some((file) => file.fileType === 'zip_package' && file.available);
    },
    auditReportFile() {
      return this.outputs.find((file) => file.fileType === 'pr_audit_result_xlsx' && file.available) || null;
    },
    isPartialCancelledResult() {
      return this.status === 'cancelled_with_partial_result';
    },
    zipLabel() {
      return this.isPartialCancelledResult ? 'Download Partial ZIP' : 'Download ZIP';
    },
    primaryDownloadLabel() {
      return this.isPrAuditorJob ? 'Download Audit Report' : this.zipLabel;
    },
    primaryDownloadUrl() {
      if (this.isPrAuditorJob && this.auditReportFile) {
        return getFileDownloadUrl(this.jobId, this.auditReportFile.id);
      }

      return this.canDownloadZip ? this.zipUrl : '';
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
      if (file.deletedAt) return 'Removed by cleanup';
      if (!file.exists) return 'Missing';
      return file.available ? 'Available' : 'Unavailable';
    },
    unavailableText(file) {
      if (file.expired) return 'Expired';
      if (file.deletedAt || file.cleanupReason) return 'Retention cleanup';
      if (!file.exists) return 'Missing';
      return 'Unavailable';
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
