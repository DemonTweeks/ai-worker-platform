<template>
  <section class="panel compact-panel">
    <div class="panel-heading">
      <span class="step-marker">2</span>
      <h2>Scope</h2>
    </div>
    <div class="segmented">
      <button
        v-for="option in options"
        :key="option"
        type="button"
        :class="{ active: value === option }"
        @click="$emit('input', option)"
      >
        {{ option }}
      </button>
    </div>
  </section>
</template>

<script>
export default {
  name: 'ScopeSelector',
  props: {
    value: { type: String, default: 'TSS' }
  },
  data() {
    return {
      options: ['TSS', 'TI']
    };
  }
};
</script>
