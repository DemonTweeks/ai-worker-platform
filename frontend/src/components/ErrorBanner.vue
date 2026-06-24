<template>
  <div v-if="message" class="error-banner" role="alert" aria-live="assertive">
    <span class="error-banner-message">{{ message }}</span>
    <button
      v-if="dismissible"
      type="button"
      class="error-banner-dismiss"
      aria-label="Dismiss notification"
      @click="$emit('dismiss')"
    >
      Dismiss
    </button>
  </div>
</template>

<script>
export default {
  name: 'ErrorBanner',
  emits: ['dismiss'],
  props: {
    message: {
      type: String,
      default: ''
    },
    dismissible: {
      type: Boolean,
      default: false
    }
  }
};
</script>
