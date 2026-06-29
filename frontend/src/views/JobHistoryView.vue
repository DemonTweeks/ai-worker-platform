<template>
  <div class="portal-shell history-page">
    <ErrorBanner :message="errorMessage" />

    <section class="hero-band">
      <div>
        <p class="eyebrow">Permanent history</p>
        <h1>Job History</h1>
      </div>
      <router-link class="download-button" to="/">Run New Job</router-link>
    </section>

    <JobHistoryFilters
      v-model="filters"
      @apply="loadJobs"
      @reset="resetFilters"
    />

    <section class="history-stats">
      <div class="stat-card"><strong>{{ total }}</strong><span>Total matches</span></div>
      <div class="stat-card"><strong>{{ visibleJobs.length }}</strong><span>Shown</span></div>
      <div class="stat-card"><strong>{{ completedCount }}</strong><span>Completed</span></div>
      <div class="stat-card"><strong>{{ failedCount }}</strong><span>Failed</span></div>
    </section>

    <section class="panel history-toolbar">
      <div class="history-toolbar-left">
        <div>
          <p class="eyebrow">History filters are preserved</p>
          <h2>Recent Job Results</h2>
        </div>
        <router-link class="secondary-button" to="/">Create New Job</router-link>
      </div>
    </section>

    <section class="history-list">
      <div v-if="loading" class="panel empty-state">
        <div class="skeleton-row">Loading job history…</div>
      </div>
      <div v-else-if="visibleJobs.length === 0" class="panel empty-state">
        No jobs match the current filters.
        <p class="muted">Try clearing filters or adjusting date range.</p>
      </div>
      <template v-else>
        <JobHistoryCard
          v-for="job in visibleJobs"
          :key="job.jobId"
          :job="job"
        />
      </template>
    </section>

    <div class="pagination-row">
      <button type="button" class="secondary-button" :disabled="page <= 1 || loading" @click="changePage(page - 1)">
        Previous
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button type="button" class="secondary-button" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">
        Next
      </button>
    </div>
  </div>
</template>

<script>
import ErrorBanner from '../components/ErrorBanner.vue';
import JobHistoryCard from '../components/history/JobHistoryCard.vue';
import JobHistoryFilters from '../components/history/JobHistoryFilters.vue';
import { getErrorMessage, listJobs } from '../api/jobApi';

const defaultFilters = () => ({
  search: '',
  status: '',
  workerId: '',
  prScope: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt_desc'
});

export default {
  name: 'JobHistoryView',
  components: {
    ErrorBanner,
    JobHistoryCard,
    JobHistoryFilters
  },
  data() {
    return {
      filters: defaultFilters(),
      jobs: [],
      total: 0,
      page: 1,
      limit: 20,
      loading: false,
      errorMessage: ''
    };
  },
  computed: {
    visibleJobs() {
      const jobs = [...this.jobs];
      if (this.filters.sortBy === 'createdAt_asc') {
        return jobs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      }
      if (this.filters.sortBy === 'status_asc') {
        return jobs.sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
      }
      return jobs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },
    totalPages() {
      return Math.max(Math.ceil(this.total / this.limit), 1);
    },
    completedCount() {
      return this.visibleJobs.filter((job) => job.status === 'completed' || job.status === 'completed_with_warning').length;
    },
    failedCount() {
      return this.visibleJobs.filter((job) => job.status === 'failed').length;
    }
  },
  mounted() {
    this.loadJobs();
  },
  methods: {
    buildQuery() {
      const query = {
        page: this.page,
        limit: this.limit,
        workerType: 'pr-worker'
      };

      ['search', 'status', 'workerId', 'prScope', 'dateFrom', 'dateTo'].forEach((key) => {
        if (this.filters[key]) query[key] = this.filters[key];
      });

      return query;
    },
    async loadJobs() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const result = await listJobs(this.buildQuery());
        this.jobs = result.items || [];
        this.total = result.total || 0;
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    resetFilters() {
      this.filters = defaultFilters();
      this.page = 1;
      this.loadJobs();
    },
    changePage(nextPage) {
      this.page = nextPage;
      this.loadJobs();
    }
  }
};
</script>
