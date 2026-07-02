<template>
  <section class="panel detail-header">
    <div>
      <p class="eyebrow">{{ workerEyebrow }}</p>
      <h1>{{ job.jobId }}</h1>
    </div>
    <div class="badge-row">
      <JobStatusBadge :status="job.status" />
      <JobScopeBadge v-if="showScopeBadge" :scope="job.prScope" />
    </div>
  </section>
</template>

<script>
import JobScopeBadge from '../history/JobScopeBadge.vue';
import JobStatusBadge from '../history/JobStatusBadge.vue';

export default {
  name: 'JobDetailHeader',
  components: {
    JobScopeBadge,
    JobStatusBadge
  },
  props: {
    job: { type: Object, required: true }
  },
  computed: {
    showScopeBadge() {
      return Boolean(this.job.prScope);
    },
    workerEyebrow() {
      const displayName = this.job.workerDisplayName || this.job.workerType || 'PR Worker';
      return this.job.workerId ? `${displayName} • ${this.job.workerId}` : displayName;
    }
  }
};
</script>
