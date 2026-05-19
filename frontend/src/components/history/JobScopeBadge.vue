<template>
  <span class="scope-badge">{{ scope || 'TSS' }}</span>
</template>

<script>
export default {
  name: 'JobScopeBadge',
  props: {
    scope: { type: String, default: 'TSS' }
  }
};
</script>
