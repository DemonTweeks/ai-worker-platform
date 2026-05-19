<template>
  <section class="panel detail-header">
    <div>
      <p class="eyebrow">Job Detail</p>
      <h1>{{ job.jobId }}</h1>
    </div>
    <div class="badge-row">
      <JobStatusBadge :status="job.status" />
      <JobScopeBadge :scope="job.prScope" />
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
  }
};
</script>
