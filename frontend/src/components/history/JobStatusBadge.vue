<template>
  <span class="badge" :class="`badge-${tone}`">{{ label }}</span>
</template>

<script>
import {
  jobStatusLabel,
  jobStatusTone,
  statusLabel,
  statusTone
} from '../../utils/jobStatusUtils';

export default {
  name: 'JobStatusBadge',
  props: {
    status: { type: String, default: '' },
    job: { type: Object, default: null }
  },
  computed: {
    label() {
      return this.job ? jobStatusLabel(this.job) : statusLabel(this.status);
    },
    tone() {
      return this.job ? jobStatusTone(this.job) : statusTone(this.status);
    }
  }
};
</script>
