<template>
  <div class="portal-shell">
    <section class="hero-band">
      <div>
        <p class="eyebrow">System Operations</p>
        <h1>Health Dashboard</h1>
      </div>
      <button type="button" class="secondary-button" :disabled="loading" @click="loadHealth">Refresh</button>
    </section>

    <ErrorBanner :message="errorMessage" />

    <div v-if="loading" class="panel empty-state">Loading health status...</div>
    <section v-else class="history-stats health-grid">
      <HealthStatusCard label="Backend" :value="backendStatus" :detail="timestamp" :tone="tone(backendStatus)" />
      <HealthStatusCard label="MongoDB" :value="mongoStatus" :detail="mongoDetail" :tone="tone(mongoStatus)" />
      <HealthStatusCard label="Storage" :value="storageStatus" :detail="storageDetail" :tone="tone(storageStatus)" />
      <HealthStatusCard label="LLM" :value="llmStatus" :detail="llmDetail" :tone="llmTone" />
      <HealthStatusCard label="Queue" :value="queueStatus" :detail="queueDetail" :tone="tone(queueStatus)" />
      <HealthStatusCard label="Active Jobs" :value="activeJobs" detail="Current worker slots in use" tone="neutral" />
      <HealthStatusCard label="Queued Jobs" :value="queuedJobs" detail="Waiting for worker slot" tone="neutral" />
      <HealthStatusCard label="WebSocket" :value="websocketStatus" :detail="websocketDetail" :tone="tone(websocketStatus)" />
      <HealthStatusCard label="Disk Usage" value="Not available" detail="Disk usage is not exposed by current backend health." tone="neutral" />
    </section>
  </div>
</template>

<script>
import HealthStatusCard from '../../components/admin/HealthStatusCard.vue';
import ErrorBanner from '../../components/ErrorBanner.vue';
import { getHealth, getErrorMessage } from '../../api/jobApi';

export default {
  name: 'AdminHealthView',
  components: {
    ErrorBanner,
    HealthStatusCard
  },
  data() {
    return {
      health: null,
      loading: false,
      errorMessage: ''
    };
  },
  computed: {
    backendStatus() {
      return this.health && this.health.status ? this.health.status : 'Not available';
    },
    timestamp() {
      return this.health && this.health.timestamp ? `Updated ${this.health.timestamp}` : '';
    },
    mongoStatus() {
      return this.health && this.health.mongo && this.health.mongo.status ? this.health.mongo.status : 'Not available';
    },
    mongoDetail() {
      return this.health && this.health.mongo && this.health.mongo.readyStateName ? this.health.mongo.readyStateName : '';
    },
    storageStatus() {
      return this.health && this.health.storage && this.health.storage.status ? this.health.storage.status : 'Not available';
    },
    storageDetail() {
      if (!this.health || !this.health.storage) return '';
      return this.health.storage.writable ? 'Writable' : 'Not writable';
    },
    llmStatus() {
      if (!this.health || !this.health.llm) return 'Not available';
      return this.health.llm.enabled ? 'enabled' : 'disabled';
    },
    llmDetail() {
      if (!this.health || !this.health.llm) return '';
      return `${this.health.llm.provider || 'provider unknown'} · configured: ${this.health.llm.configured ? 'yes' : 'no'}`;
    },
    llmTone() {
      if (!this.health || !this.health.llm) return 'neutral';
      return this.health.llm.enabled && this.health.llm.configured ? 'ok' : 'neutral';
    },
    queueStatus() {
      return this.health && this.health.queue ? 'ok' : 'Not available';
    },
    queueDetail() {
      if (!this.health || !this.health.queue) return '';
      return `Max ${this.health.queue.maxConcurrentJobs || 0} concurrent`;
    },
    activeJobs() {
      return this.health && this.health.queue ? String(this.health.queue.activeCount || 0) : 'Not available';
    },
    queuedJobs() {
      return this.health && this.health.queue ? String(this.health.queue.queuedCount || 0) : 'Not available';
    },
    websocketStatus() {
      return this.health && this.health.websocket && this.health.websocket.status ? this.health.websocket.status : 'Not available';
    },
    websocketDetail() {
      if (!this.health || !this.health.websocket) return '';
      return `${this.health.websocket.connectedClients || 0} connected clients`;
    }
  },
  mounted() {
    this.loadHealth();
  },
  methods: {
    async loadHealth() {
      this.loading = true;
      this.errorMessage = '';
      try {
        this.health = await getHealth();
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    tone(status) {
      const value = String(status || '').toLowerCase();
      if (['ok', 'connected', 'enabled'].includes(value)) return 'ok';
      if (value === 'not available') return 'neutral';
      if (['degraded', 'not_started'].includes(value)) return 'warning';
      return 'danger';
    }
  }
};
</script>
