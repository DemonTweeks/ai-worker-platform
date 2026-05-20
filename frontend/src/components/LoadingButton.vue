<template>
  <button type="button" class="action-button" :disabled="disabled || loading" :aria-busy="loading" @click="$emit('click')">
    {{ loading ? loadingText : label }}
  </button>
</template>

<script>
export default {
  name: 'LoadingButton',
  props: {
    label: { type: String, required: true },
    loadingText: { type: String, default: 'Working...' },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  }
};
</script>
