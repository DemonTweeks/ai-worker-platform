<template>
  <div class="portal-shell">


    <section class="page-title-bar">
      <div>
        <p class="page-eyebrow">System Operations</p>
        <h2>Health Console</h2>
      </div>
      <button type="button" class="secondary-button" :disabled="loading" @click="loadHealth">Refresh</button>
    </section>

    <ErrorBanner :message="errorMessage" />

    <div v-if="loading" class="panel empty-state">Loading health status...</div>
    <section v-else class="history-stats health-grid">
      <HealthStatusCard label="Backend" :value="formatStatus(backendStatus)" :detail="timestamp" :tone="tone(backendStatus)" />
      <HealthStatusCard label="Firebase DB" :value="formatStatus(firebaseStatus)" :detail="firebaseDetail" :tone="tone(firebaseStatus)" />
      <HealthStatusCard label="Storage" :value="formatStatus(storageStatus)" :detail="storageDetail" :tone="tone(storageStatus)" />
      <HealthStatusCard label="LLM" :value="formatStatus(llmStatus)" :detail="llmDetail" :tone="tone(llmStatus)" />
      <HealthStatusCard label="Queue" :value="formatStatus(queueStatus)" :detail="queueDetail" :tone="tone(queueStatus)" />
      <HealthStatusCard label="Active Jobs" :value="activeJobs" detail="Current worker slots in use" tone="neutral" />
      <HealthStatusCard label="Queued Jobs" :value="queuedJobs" detail="Waiting for worker slot" tone="neutral" />
      <HealthStatusCard label="WebSocket" :value="formatStatus(websocketStatus)" :detail="websocketDetail" :tone="tone(websocketStatus)" />
      <HealthStatusCard label="Disk Usage" :value="diskUsage" :detail="diskDetail" :tone="diskTone" />
      <HealthStatusCard label="Cleanup" :value="formatStatus(cleanupStatus)" :detail="cleanupDetail" :tone="tone(cleanupStatus)" />
      <DeploymentActionCard
        :disabled="deploymentDisabled"
        :loading="deploying"
        :waiting="waitingForBackend"
        :tone="deploymentTone"
        :detail="deploymentDetail"
        @deploy="triggerDeploy"
      />
    </section>

    <section v-if="health" class="panel info-panel">
      <h2>Last Checked</h2>
      <p class="muted">{{ timestamp || 'Not available' }}</p>
      <p class="helper-text">Use this view for run-time troubleshooting and incident checks.</p>
    </section>
  </div>
</template>

<script>
import HealthStatusCard from '../../components/admin/HealthStatusCard.vue';
import DeploymentActionCard from '../../components/admin/DeploymentActionCard.vue';
import ErrorBanner from '../../components/ErrorBanner.vue';
import { getHealth, getErrorMessage } from '../../api/jobApi';
import { triggerDeployment, getAdminErrorMessage } from '../../api/adminApi';

const DEPLOYMENT_HEALTH_POLL_INTERVAL_MS = 15000;

export default {
  name: 'AdminHealthView',
  components: {
    ErrorBanner,
    DeploymentActionCard,
    HealthStatusCard
  },
  data() {
    return {
      health: null,
      loading: false,
      deploying: false,
      waitingForBackend: false,
      deploymentHealthTimer: null,
      deploymentResult: null,
      deploymentError: '',
      errorMessage: ''
    };
  },
  computed: {
    deploymentDisabled() {
      return this.backendPlatform === 'win32';
    },
    backendPlatform() {
      const backend = this.services.backend;
      return backend && backend.platform ? String(backend.platform).toLowerCase() : '';
    },
    deploymentTone() {
      if (this.deploymentError) return 'danger';
      if (this.waitingForBackend) return 'warning';
      if (this.deploymentResult) return 'ok';
      return this.deploying ? 'warning' : 'neutral';
    },
    deploymentDetail() {
      if (this.deploymentDisabled) return 'Deployment is unavailable on Windows.';
      if (this.deploymentError) return this.deploymentError;
      if (this.waitingForBackend) return 'Deployment started. Checking backend availability every 15 seconds.';
      if (this.deploymentResult && this.deploymentResult.backendReadyAt) return `Backend available again at ${this.deploymentResult.backendReadyAt}.`;
      return this.deploying
        ? 'Sending deployment request...'
        : 'Run stop-services.sh, then deploy.sh';
    },
    services() {
      return this.health && this.health.services ? this.health.services : {};
    },
    backendStatus() {
      return this.services.backend && this.services.backend.status ? this.services.backend.status : this.health && this.health.status ? this.health.status : 'Not available';
    },
    timestamp() {
      return this.health && this.health.timestamp ? `Updated ${this.health.timestamp}` : '';
    },
    firebaseStatus() {
      return this.services.firebase && this.services.firebase.status ? this.services.firebase.status : 'Not available';
    },
    firebaseDetail() {
      if (!this.services.firebase) return '';
      const conn = this.services.firebase.connected ? 'Connected' : 'Disconnected';
      const latency = this.services.firebase.latencyMs ? ` · ${this.services.firebase.latencyMs}ms` : '';
      return `${conn}${latency}`;
    },
    storageStatus() {
      return this.services.storage && this.services.storage.status ? this.services.storage.status : 'Not available';
    },
    storageDetail() {
      if (!this.services.storage) return '';
      const root = this.services.storage.rootLabel ? `Root: ${this.services.storage.rootLabel}` : 'Root unavailable';
      return `${root} · ${this.services.storage.writable ? 'Writable' : 'Not writable'}`;
    },
    llmStatus() {
      if (!this.services.llm) return 'Not available';
      return this.services.llm.status || (this.services.llm.enabled ? 'enabled' : 'disabled');
    },
    llmDetail() {
      if (!this.services.llm) return '';
      return `${this.services.llm.provider || 'provider unknown'} · ${this.services.llm.model || 'model unknown'} · configured: ${this.services.llm.configured ? 'yes' : 'no'}`;
    },
    queueStatus() {
      return this.services.queue && this.services.queue.status ? this.services.queue.status : 'Not available';
    },
    queueDetail() {
      if (!this.services.queue) return '';
      return `Max ${this.services.queue.maxConcurrentJobs || 0} concurrent · capacity ${this.services.queue.capacityAvailable || 0}`;
    },
    activeJobs() {
      return this.services.queue ? String(this.services.queue.activeCount || 0) : 'Not available';
    },
    queuedJobs() {
      return this.services.queue ? String(this.services.queue.queuedCount || 0) : 'Not available';
    },
    websocketStatus() {
      return this.services.websocket && this.services.websocket.status ? this.services.websocket.status : 'Not available';
    },
    websocketDetail() {
      if (!this.services.websocket) return '';
      return `${this.services.websocket.connectedClients || 0} clients · ${this.services.websocket.subscribedJobs || 0} subscribed jobs · heartbeat ${this.services.websocket.heartbeatIntervalMs || 0}ms`;
    },
    diskUsage() {
      const disk = this.services.storage && this.services.storage.disk;
      if (!disk || !disk.available || disk.usedPercent === null || disk.usedPercent === undefined) return 'Not available';
      return `${disk.usedPercent}% used`;
    },
    diskDetail() {
      const disk = this.services.storage && this.services.storage.disk;
      if (!disk || !disk.available) return disk && disk.reason ? disk.reason : 'Disk usage is unavailable.';
      return `${this.formatBytes(disk.freeBytes)} free of ${this.formatBytes(disk.totalBytes)}`;
    },
    diskTone() {
      const disk = this.services.storage && this.services.storage.disk;
      if (!disk || !disk.available || disk.usedPercent === null || disk.usedPercent === undefined) return 'neutral';
      if (disk.usedPercent >= 95) return 'danger';
      if (disk.usedPercent >= 85) return 'warning';
      return 'ok';
    },
    cleanupStatus() {
      return this.services.cleanup && this.services.cleanup.status ? this.services.cleanup.status : 'Not available';
    },
    cleanupDetail() {
      if (!this.services.cleanup) return '';
      const retention = this.services.cleanup.retentionDays !== undefined
        ? `${this.services.cleanup.retentionDays} day retention`
        : 'Retention unavailable';
      const schedule = this.services.cleanup.automaticScheduleEnabled ? 'scheduled' : 'manual';
      return `${retention} · dry-run ${this.services.cleanup.dryRunSupported ? 'supported' : 'unavailable'} · ${schedule}`;
    }
  },
  mounted() {
    this.loadHealth();
  },
  beforeDestroy() {
    this.clearDeploymentHealthTimer();
  },
  methods: {
    async triggerDeploy() {
      if (this.deploymentDisabled) return;
      this.clearDeploymentHealthTimer();
      this.deploying = true;
      this.waitingForBackend = false;
      this.deploymentError = '';
      this.deploymentResult = null;
      try {
        this.deploymentResult = await triggerDeployment();
        this.waitingForBackend = true;
        this.scheduleDeploymentHealthCheck();
      } catch (error) {
        this.deploymentError = getAdminErrorMessage(error);
      } finally {
        this.deploying = false;
      }
    },
    clearDeploymentHealthTimer() {
      if (this.deploymentHealthTimer) {
        clearTimeout(this.deploymentHealthTimer);
        this.deploymentHealthTimer = null;
      }
    },
    scheduleDeploymentHealthCheck() {
      this.clearDeploymentHealthTimer();
      this.deploymentHealthTimer = setTimeout(
        () => this.checkDeploymentHealth(),
        DEPLOYMENT_HEALTH_POLL_INTERVAL_MS
      );
    },
    async checkDeploymentHealth() {
      this.deploymentHealthTimer = null;
      if (!this.waitingForBackend) return;
      try {
        this.health = await getHealth();
        this.waitingForBackend = false;
        this.deploymentResult = {
          ...this.deploymentResult,
          backendReadyAt: new Date().toISOString()
        };
      } catch (error) {
        if (this.waitingForBackend) this.scheduleDeploymentHealthCheck();
      }
    },
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
      if (['ok', 'connected'].includes(value)) return 'ok';
      if (['disabled', 'not available'].includes(value)) return 'neutral';
      if (['degraded', 'not_started', 'not_configured', 'unknown'].includes(value)) return 'warning';
      return 'danger';
    },
    formatStatus(status) {
      const val = String(status || '').toLowerCase();
      if (['ok', 'connected'].includes(val)) return '🟢Healthy';
      if (['degraded', 'not_started', 'not_configured', 'unknown'].includes(val)) return '🟡Degraded';
      if (['down', 'failed'].includes(val)) return '🔴Down';
      if (['disabled', 'not available'].includes(val)) return '⚪Unavailable';
      return '🔵Checking';
    },
    formatBytes(value) {
      const bytes = Number(value) || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
  }
};
</script>
