<template>
  <article class="stat-card health-card" :class="toneClass">
    <div class="health-card-header">
      <span class="health-label">{{ label }}</span>
      <span class="health-status-indicator" :class="tone"></span>
    </div>
    <strong class="health-value">{{ value }}</strong>
    <small v-if="detail" class="health-detail">{{ detail }}</small>
  </article>
</template>

<script>
export default {
  name: 'HealthStatusCard',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: 'Not available' },
    detail: { type: String, default: '' },
    tone: { type: String, default: 'neutral' }
  },
  computed: {
    toneClass() {
      return `health-${this.tone}`;
    }
  }
};
</script>