<template>
  <article class="panel history-results-panel">
    <div class="history-table-scroll" tabindex="0" aria-label="Scrollable historical job results">
      <table class="history-results-table">
        <caption class="history-results-caption">Historical job results</caption>
        <thead>
          <tr>
            <th class="history-index-column" scope="col">No.</th>
            <th class="history-site-column" scope="col">Site Code</th>
            <th scope="col">Job ID</th>
            <th scope="col">Worker</th>
            <th scope="col">Status</th>
            <th scope="col">Run Mode</th>
            <th scope="col">Project</th>
            <th scope="col">PR Scope</th>
            <th class="history-number-cell" scope="col">Requested</th>
            <th class="history-number-cell" scope="col">Matched</th>
            <th class="history-number-cell" scope="col">Unmatched</th>
            <th class="history-number-cell" scope="col">Outputs</th>
            <th class="history-number-cell" scope="col">Review</th>
            <th class="history-number-cell" scope="col">Warnings</th>
            <th scope="col">Summary</th>
            <th scope="col">Created</th>
            <th scope="col">Completed</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(job, index) in jobs" :key="job.jobId">
            <td class="history-index-column">{{ startIndex + index + 1 }}</td>
            <td class="history-site-column">
              <span class="history-site-code" :title="siteCodeTitle(job)">{{ siteCodeDisplay(job) }}</span>
            </td>
            <td class="history-job-id">{{ job.jobId }}</td>
            <td>{{ workerLabel(job) }}</td>
            <td><JobStatusBadge :status="job.status" :job="job" /></td>
            <td>{{ job.runMode || '—' }}</td>
            <td>{{ job.selectedProject || '—' }}</td>
            <td>{{ job.prScope || '—' }}</td>
            <td class="history-number-cell">{{ count(job.requestedSiteCount) }}</td>
            <td class="history-number-cell">{{ count(job.matchedSiteCount) }}</td>
            <td class="history-number-cell">{{ count(job.unmatchedSiteCount) }}</td>
            <td class="history-number-cell">{{ count(job.outputFileCount) }}</td>
            <td class="history-number-cell">{{ count(job.reviewRequiredCount) }}</td>
            <td class="history-number-cell">{{ count(job.warningCount) }}</td>
            <td class="history-summary-cell">
              <span :title="summaryText(job)">{{ summaryText(job) }}</span>
            </td>
            <td>{{ formatDateTime(job.createdAt) }}</td>
            <td>{{ job.completedAt ? formatDateTime(job.completedAt) : 'In progress' }}</td>
            <td class="history-actions-cell">
              <div class="history-table-actions">
                <router-link
                  class="download-button"
                  :to="{ name: 'job-detail', params: { jobId: job.jobId } }"
                >
                  View
                </router-link>
                <a
                  v-if="availableOutputFile(job)"
                  class="secondary-link"
                  :href="downloadUrl(job)"
                  :title="downloadTitle(job)"
                >
                  Download
                </a>
                <span v-else class="muted">No output</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>

<script>
import { getFileDownloadUrl } from '../../api/jobApi';
import { formatDateTime } from '../../utils/formatUtils';
import { isIncompleteResult } from '../../utils/jobStatusUtils';
import {
  findAvailableAuditReport,
  findAvailableArchive,
  isPrAuditorWorker
} from '../../utils/prAuditorResultUtils';
import JobStatusBadge from './JobStatusBadge.vue';

export default {
  name: 'JobHistoryTable',
  components: {
    JobStatusBadge
  },
  props: {
    jobs: { type: Array, required: true },
    startIndex: { type: Number, default: 0 }
  },
  methods: {
    formatDateTime,
    count(value) {
      return value === null || value === undefined ? 0 : value;
    },
    workerLabel(job) {
      return job.workerDisplayName || job.workerId || job.workerType || 'PR Worker';
    },
    siteCodes(job) {
      return Array.from(new Set(
        (Array.isArray(job.matchedSiteCodes) ? job.matchedSiteCodes : [])
          .filter((siteCode) => typeof siteCode === 'string' && siteCode.trim())
          .map((siteCode) => siteCode.trim())
      ));
    },
    siteCodeDisplay(job) {
      const siteCodes = this.siteCodes(job);
      if (!siteCodes.length) return job.generationScope === 'all_sites' ? 'All sites' : '—';
      return siteCodes.length === 1 ? siteCodes[0] : siteCodes[0] + ' +' + (siteCodes.length - 1);
    },
    siteCodeTitle(job) {
      const siteCodes = this.siteCodes(job);
      return siteCodes.length ? siteCodes.join(', ') : this.siteCodeDisplay(job);
    },
    summaryText(job) {
      return job.failureSummary || job.finalWorkerSummary || '—';
    },
    availableOutputFile(job) {
      const outputs = Array.isArray(job.outputs) ? job.outputs : [];
      const auditReport = findAvailableAuditReport(outputs);
      if (isPrAuditorWorker(job.workerId) && auditReport) return auditReport;
      const archive = findAvailableArchive(outputs);
      if (archive) return archive;
      return outputs.find((file) => file.available) || null;
    },
    downloadUrl(job) {
      const output = this.availableOutputFile(job);
      return output ? getFileDownloadUrl(job.jobId, output.id) : '';
    },
    downloadTitle(job) {
      if (isPrAuditorWorker(job.workerId) && findAvailableAuditReport(job.outputs)) {
        return 'Download audit report';
      }
      if (job.status === 'cancelled_with_partial_result' || isIncompleteResult(job)) {
        return 'Download partial output';
      }
      return 'Download output';
    }
  }
};
</script>
