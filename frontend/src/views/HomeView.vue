<template>
  <section class="worker-shell">
    <div class="panel">
      <h2>PR Worker Foundation</h2>
      <p>
        The project foundation is ready for the PR Worker MVP. Backend health is checked from this Vue2 app.
      </p>
      <button type="button" @click="checkHealth" :disabled="loading">
        {{ loading ? 'Checking...' : 'Check Backend Health' }}
      </button>
    </div>

    <div class="status-panel" :class="statusClass">
      <span class="status-label">Backend</span>
      <strong>{{ healthLabel }}</strong>
      <small v-if="healthTimestamp">Last checked: {{ healthTimestamp }}</small>
      <small v-if="errorMessage">{{ errorMessage }}</small>
    </div>
  </section>
</template>

<script>
import api from '../api';

export default {
  name: 'HomeView',
  data() {
    return {
      loading: false,
      health: null,
      errorMessage: ''
    };
  },
  computed: {
    healthLabel() {
      if (this.loading) return 'Checking';
      if (this.health && this.health.status === 'ok') return 'Healthy';
      if (this.errorMessage) return 'Unavailable';
      return 'Not checked';
    },
    healthTimestamp() {
      return this.health && this.health.timestamp ? this.health.timestamp : '';
    },
    statusClass() {
      if (this.health && this.health.status === 'ok') return 'is-ok';
      if (this.errorMessage) return 'is-error';
      return '';
    }
  },
  mounted() {
    this.checkHealth();
  },
  methods: {
    async checkHealth() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const response = await api.get('/health');
        this.health = response.data;
      } catch (error) {
        this.health = null;
        this.errorMessage = 'Unable to reach backend health endpoint.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
