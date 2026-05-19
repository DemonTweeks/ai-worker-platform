<template>
  <div v-if="message" class="error-banner">
    {{ message }}
  </div>
</template>

<script>
export default {
  name: 'ErrorBanner',
  props: {
    message: {
      type: String,
      default: ''
    }
  }
};
</script>
