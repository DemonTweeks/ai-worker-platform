<template>
  <div v-if="normalized.message" class="error-banner" :class="normalizedClass" role="status" aria-live="polite">
    <div class="error-banner-content">
      <p>{{ normalized.message }}</p>
    </div>
    <button
      v-if="normalized.dismissible"
      type="button"
      class="error-banner-dismiss"
      aria-label="Dismiss notification"
      @click="$emit('dismiss')"
    >
      Close
    </button>
  </div>
</template>

<script>
export default {
  name: 'ErrorBanner',
  props: {
    message: {
      type: [String, Object],
      default: ''
    }
  },
  computed: {
    normalized() {
      if (this.message && typeof this.message === 'object') {
        return {
          message: this.message.message || '',
          dismissible: Boolean(this.message.dismissible),
          tone: this.message.tone || 'danger'
        };
      }

      return {
        message: this.message || '',
        dismissible: false,
        tone: 'danger'
      };
    },
    normalizedClass() {
      return this.normalized.tone ? `is-${this.normalized.tone}` : '';
    }
  }
};
</script>
