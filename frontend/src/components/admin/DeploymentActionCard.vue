<template>
  <button
    type="button"
    class="stat-card health-card deployment-action-card"
    :class="`health-${tone}`"
    :disabled="loading || waiting"
    @click="$emit('deploy')"
  >
    <span class="health-card-header">
      <span class="health-label">Deployment</span>
      <span class="health-status-indicator" :class="tone"></span>
    </span>
    <strong class="health-value">{{ cardValue }}</strong>
    <small class="health-detail">{{ detail }}</small>
  </button>
</template>

<script>
export default {
  name: 'DeploymentActionCard',
  props: {
    loading: { type: Boolean, default: false },
    waiting: { type: Boolean, default: false },
    tone: { type: String, default: 'neutral' },
    detail: { type: String, required: true }
  },
  computed: {
    cardValue() {
      if (this.loading) return 'Starting...';
      if (this.waiting) return 'Recovering...';
      return 'Deploy';
    }
  }
};
</script>
