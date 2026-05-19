<template>
  <article class="stat-card health-card" :class="toneClass">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
    <small v-if="detail">{{ detail }}</small>
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
