<template>
  <section class="panel">
    <h2>Live Events</h2>
    <div v-if="events.length === 0" class="empty-state">No realtime events yet. Start a job to receive updates.</div>
    <template v-else>
      <div class="timeline-subline">{{ statusSummary }}</div>
      <ol class="timeline">
        <li v-for="(event, index) in events" :key="`${event.timestamp || index}-${index}`" :class="eventClass(event)">
          <div class="timeline-title">
            <strong>{{ event.event || event.type }}</strong>
            <span>{{ formatDateTime(event.timestamp) }}</span>
          </div>
          <p>{{ event.displayText }}</p>
          <small>{{ event.status || 'status unavailable' }} · {{ event.phase || 'phase unavailable' }}</small>
        </li>
      </ol>
    </template>
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
    formatDateTime,
    eventClass(event) {
      if (!event) return '';
      const status = String(event.status || '').toLowerCase();
      if (status === 'completed' || status === 'completed_with_warning') return 'timeline-ok';
      if (status === 'failed' || status === 'cancelled') return 'timeline-fail';
      return '';
    }
  },
  computed: {
    statusSummary() {
      return `${this.events.length} event(s) received.`;
    }
  }
};
</script>
