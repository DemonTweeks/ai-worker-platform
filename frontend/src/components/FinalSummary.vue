<template>
  <section class="panel">
    <h2>Final Summary</h2>
    <div v-if="!detail" class="empty-state">No final summary yet.</div>
    <div v-else>
      <div class="summary-grid">
        <span>Status: <strong>{{ detail.job.status }}</strong></span>
        <span>Scope: <strong>{{ detail.job.prScope || 'TSS' }}</strong></span>
        <span>Requested: <strong>{{ detail.job.requestedSiteCount || 0 }}</strong></span>
        <span>Matched: <strong>{{ detail.job.matchedSiteCount || 0 }}</strong></span>
        <span>Unmatched: <strong>{{ detail.job.unmatchedSiteCount || 0 }}</strong></span>
        <span>Outputs: <strong>{{ detail.job.outputFileCount || 0 }}</strong></span>
        <span>Warnings: <strong>{{ detail.job.warningCount || 0 }}</strong></span>
        <span>Review Required: <strong>{{ detail.job.reviewRequiredCount || 0 }}</strong></span>
      </div>
      <pre class="summary-text">{{ detail.finalWorkerSummary || detail.job.finalWorkerSummary || 'Summary unavailable.' }}</pre>
      <p v-if="detail.job.error && detail.job.error.message" class="error-text">{{ detail.job.error.message }}</p>
    </div>
  </section>
</template>

<script>
export default {
  name: 'FinalSummary',
  props: {
    detail: { type: Object, default: null }
  }
};
</script>
