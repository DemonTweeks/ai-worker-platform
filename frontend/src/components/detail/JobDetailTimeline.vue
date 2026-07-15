<template>
  <section class="panel">
    <h2>Timeline</h2>
    <ol class="timeline detail-timeline">
      <li>
        <div class="timeline-title">
          <strong>Created</strong>
          <span>{{ formatDateTime(job.createdAt) }}</span>
        </div>
        <p>Job record was created.</p>
      </li>
      <li v-if="job.startedAt">
        <div class="timeline-title">
          <strong>Started</strong>
          <span>{{ formatDateTime(job.startedAt) }}</span>
        </div>
        <p>Worker execution started.</p>
      </li>
      <li v-if="showExecutedSites">
        <div class="timeline-title">
          <strong>Sites executed</strong>
          <span>{{ executedSiteCodes.length }} site{{ executedSiteCodes.length === 1 ? '' : 's' }}</span>
        </div>
        <p class="timeline-site-codes">{{ executedSiteCodes.join(', ') }}</p>
      </li>
      <li v-if="job.completedAt">
        <div class="timeline-title">
          <strong>Completed</strong>
          <span>{{ formatDateTime(job.completedAt) }}</span>
        </div>
        <p>Job reached status {{ job.status }}.</p>
      </li>
      <li v-if="job.cancelledAt">
        <div class="timeline-title">
          <strong>Cancelled</strong>
          <span>{{ formatDateTime(job.cancelledAt) }}</span>
        </div>
        <p>Job cancellation was recorded{{ job.cancellation ? `: ${job.cancellation.reasonText || job.cancellation.reasonLabel}.` : '.' }}</p>
      </li>
      <li v-if="liveEvents.length > 0">
        <div class="timeline-title">
          <strong>Live updates</strong>
          <span>{{ liveEvents.length }}</span>
        </div>
        <p>Realtime updates are shown below while this job is active.</p>
      </li>
    </ol>
    <JobEventTimeline v-if="liveEvents.length > 0" :events="liveEvents" />
  </section>
</template>

<script>
import JobEventTimeline from '../JobEventTimeline.vue';
import { formatDateTime } from '../../utils/formatUtils';

export default {
  name: 'JobDetailTimeline',
  components: { JobEventTimeline },
  props: {
    job: { type: Object, required: true },
    liveEvents: { type: Array, default: () => [] }
  },
  computed: {
    executedSiteCodes() {
      return Array.isArray(this.job.matchedSiteCodes)
        ? this.job.matchedSiteCodes.filter((siteCode) => typeof siteCode === 'string' && siteCode.trim())
        : [];
    },
    showExecutedSites() {
      return ['completed', 'completed_with_warning'].includes(this.job.status)
        && this.executedSiteCodes.length > 0;
    }
  },
  methods: {
    formatDateTime
  }
};
</script>
