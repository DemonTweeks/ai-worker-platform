<template>
  <span class="badge" :class="`badge-${tone}`">{{ label }}</span>
</template>

<script>
import { statusLabel, statusTone } from '../../utils/jobStatusUtils';

export default {
  name: 'JobStatusBadge',
  props: {
    status: { type: String, default: '' }
  },
  computed: {
    label() {
      return statusLabel(this.status);
    },
    tone() {
      return statusTone(this.status);
    }
  }
};
</script>
