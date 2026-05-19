<template>
  <section class="panel">
    <h2>Timeline</h2>
    <div v-if="events.length === 0" class="empty-state">No realtime events yet.</div>
    <ol v-else class="timeline">
      <li v-for="(event, index) in events" :key="`${event.timestamp || index}-${index}`">
        <div class="timeline-title">
          <strong>{{ event.event || event.type }}</strong>
          <span>{{ formatDateTime(event.timestamp) }}</span>
        </div>
        <p>{{ event.displayText }}</p>
        <small>{{ event.status || 'status unavailable' }} · {{ event.phase || 'phase unavailable' }}</small>
      </li>
    </ol>
  </section>
</template>

<script>
import { formatDateTime } from '../utils/formatUtils';

export default {
  name: 'JobEventTimeline',
  props: {
    events: { type: Array, default: () => [] }
  },
  methods: {
    formatDateTime
  }
};
</script>
