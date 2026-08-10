<template>
  <section class="home-cockpit" aria-label="Platform dashboard">
    <section class="workbench-hero" aria-label="AI Worker platform dashboard">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>Dashboard</h2>
        <p class="workbench-subtitle">
          Platform-wide navigation and current operational context live here. Use the worker routes for PR Creator and PR Auditor launches.
        </p>

        <div class="workbench-chip-row" aria-label="Platform status">
          <span class="workbench-chip">{{ healthLabel }}</span>
          <span class="workbench-chip">{{ activeJobsLabel }}</span>
          <span class="workbench-chip">{{ selectedJobLabel }}</span>
        </div>
      </div>

      <section class="workbench-surface" aria-label="Dashboard summary">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Platform Overview</p>
            <h3>Global Routes</h3>
          </div>
          <span class="workbench-status-pill">Read-only</span>
        </div>

        <div class="workbench-main-grid">
          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Workers</span>
              <small>Dedicated launch routes</small>
            </div>
            <div class="cockpit-empty-card">
              <p>Open the dedicated worker route that matches the task you want to run.</p>
              <div class="workbench-action-row">
                <router-link class="workbench-primary-link" to="/workers/pr-creator">PR Creator</router-link>
                <router-link class="workbench-secondary-link" to="/workers/ran-pr-creator">RAN PR Creator</router-link>
                <router-link class="workbench-secondary-link" to="/workers/pr-auditor">PR Auditor</router-link>
              </div>
            </div>
          </section>

          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Monitoring</span>
              <small>Platform-global pages</small>
            </div>
            <div class="cockpit-empty-card">
              <p>Use the global routes below for cross-worker monitoring and administration.</p>
              <div class="workbench-action-row">
                <router-link class="workbench-secondary-link" to="/history">History</router-link>
                <router-link class="workbench-secondary-link" :to="statusLink">Status</router-link>
                <router-link class="workbench-secondary-link" to="/admin/health">Health</router-link>
                <router-link class="workbench-secondary-link" to="/admin/login">Admin</router-link>
              </div>
            </div>
          </section>

          <section class="panel cockpit-card workbench-result-card dashboard-active-jobs-card">
            <div class="cockpit-card-heading">
              <span>Active Jobs</span>
              <small>{{ activeJobs.length }} active</small>
            </div>
            <div v-if="activeJobs.length === 0" class="cockpit-empty-card">
              No active jobs are visible for this browser tab right now.
            </div>
            <div v-else class="download-compact">
              <table class="active-jobs-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Worker</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="job in activeJobs" :key="job.jobId">
                    <td>{{ job.jobId }}</td>
                    <td>{{ job.workerDisplayName || job.workerId }}</td>
                    <td>{{ job.status }}</td>
                    <td>
                      <time class="job-created-time" :datetime="job.createdAt || null">
                        {{ formatCompactDateTime(job.createdAt, 'Just now') }}
                      </time>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </section>
  </section>
</template>

<script>
import { getHealth, getErrorMessage, listJobs } from '../api/jobApi';
import { formatCompactDateTime } from '../utils/formatUtils';
import { isTerminalStatus } from '../utils/statusUtils';

const SELECTED_JOB_STORAGE_KEY = 'selectedJobId';
const BROWSER_TAB_SESSION_STORAGE_KEY = 'browserTabSessionId';

export default {
  name: 'DashboardView',
  data() {
    return {
      health: null,
      healthError: false,
      activeJobs: [],
      selectedJobId: ''
    };
  },
  computed: {
    healthLabel() {
      if (this.health && this.health.status === 'ok') return '🟢Healthy';
      if (this.health && this.health.status === 'degraded') return '🟡Degraded';
      if (this.health && this.health.status === 'down') return '🔴Down';
      if (this.healthError) return '⚪Unavailable';
      return '🔵Checking';
    },
    activeJobsLabel() {
      return `${this.activeJobs.length} active job${this.activeJobs.length === 1 ? '' : 's'}`;
    },
    selectedJobLabel() {
      return this.selectedJobId ? `Status linked to ${this.selectedJobId}` : 'No selected status job';
    },
    statusLink() {
      return this.selectedJobId ? `/jobs/${this.selectedJobId}` : '/history';
    }
  },
  mounted() {
    this.selectedJobId = sessionStorage.getItem(SELECTED_JOB_STORAGE_KEY) || '';
    this.loadDashboardSummary();
  },
  methods: {
    formatCompactDateTime,
    async loadDashboardSummary() {
      await Promise.all([
        this.loadHealth(),
        this.loadActiveJobs()
      ]);
    },
    async loadHealth() {
      try {
        this.health = await getHealth();
        this.healthError = false;
      } catch (error) {
        this.health = null;
        this.healthError = true;
      }
    },
    async loadActiveJobs() {
      try {
        const result = await listJobs({
          workerType: 'pr-worker',
          browserTabSessionId: sessionStorage.getItem(BROWSER_TAB_SESSION_STORAGE_KEY) || '',
          limit: 10
        });
        this.activeJobs = Array.isArray(result.items)
          ? result.items.filter((job) => !isTerminalStatus(job.status))
          : [];
      } catch (error) {
        this.activeJobs = [];
        this.healthError = this.healthError || Boolean(getErrorMessage(error));
      }
    }
  }
};
</script>
<style scoped>
.dashboard-active-jobs-card {
  grid-column: 1 / -1;
  min-width: 0;
}

.dashboard-active-jobs-card .cockpit-empty-card {
  min-height: 0;
}

.dashboard-active-jobs-card .download-compact {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.dashboard-active-jobs-card .active-jobs-table {
  width: 100%;
  table-layout: fixed;
}

.dashboard-active-jobs-card .active-jobs-table th:nth-child(1) { width: 24%; }
.dashboard-active-jobs-card .active-jobs-table th:nth-child(2) { width: 28%; }
.dashboard-active-jobs-card .active-jobs-table th:nth-child(3) { width: 20%; }
.dashboard-active-jobs-card .active-jobs-table th:nth-child(4) { width: 28%; }

.dashboard-active-jobs-card .active-jobs-table th,
.dashboard-active-jobs-card .active-jobs-table td {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.dashboard-active-jobs-card .job-created-time {
  white-space: normal;
}
</style>
