<template>
  <div class="portal-shell">
    <section class="hero-band">
      <div>
        <p class="eyebrow">Audit History</p>
        <h1>Audit Logs</h1>
      </div>
      <button type="button" class="secondary-button" :disabled="loading" @click="loadLogs">Refresh</button>
    </section>

    <ErrorBanner :message="errorMessage" />

    <section class="panel history-filters">
      <div class="filter-grid audit-filter-grid">
        <label>
          <span class="field-label">Keyword</span>
          <input v-model="keyword" placeholder="Admin, version, IP" />
        </label>
        <label>
          <span class="field-label">Action</span>
          <select v-model="filters.action">
            <option value="">All actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="ASSET_UPLOAD">ASSET_UPLOAD</option>
            <option value="ASSET_ACTIVATE">ASSET_ACTIVATE</option>
          </select>
        </label>
        <label>
          <span class="field-label">Asset Type</span>
          <select v-model="filters.assetType">
            <option value="">All assets</option>
            <option value="pr_model">PR Model</option>
            <option value="contract_info">Contract Info</option>
            <option value="ecc_template">ECC Template</option>
          </select>
        </label>
        <label>
          <span class="field-label">Status</span>
          <select v-model="filters.status">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>
      <div class="filter-actions">
        <button type="button" @click="loadLogs">Apply</button>
        <button type="button" class="secondary-button" @click="resetFilters">Reset</button>
      </div>
    </section>

    <div v-if="loading" class="panel empty-state">Loading audit logs...</div>
    <AuditLogTable v-else :logs="visibleLogs" />
  </div>
</template>

<script>
import AuditLogTable from '../../components/admin/AuditLogTable.vue';
import ErrorBanner from '../../components/ErrorBanner.vue';
import { getAdminErrorMessage, listAuditLogs } from '../../api/adminApi';

const defaultFilters = () => ({
  action: '',
  assetType: '',
  status: ''
});

export default {
  name: 'AdminAuditLogsView',
  components: {
    AuditLogTable,
    ErrorBanner
  },
  data() {
    return {
      filters: defaultFilters(),
      keyword: '',
      logs: [],
      loading: false,
      errorMessage: ''
    };
  },
  computed: {
    visibleLogs() {
      const keyword = this.keyword.trim().toLowerCase();
      if (!keyword) return this.logs;
      return this.logs.filter((log) => [
        log.admin,
        log.action,
        log.assetType,
        log.version,
        log.status,
        log.ip
      ].some((value) => String(value || '').toLowerCase().includes(keyword)));
    }
  },
  mounted() {
    this.loadLogs();
  },
  methods: {
    async loadLogs() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const params = { limit: 100 };
        Object.keys(this.filters).forEach((key) => {
          if (this.filters[key]) params[key] = this.filters[key];
        });
        const result = await listAuditLogs(params);
        this.logs = result.items || [];
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    resetFilters() {
      this.filters = defaultFilters();
      this.keyword = '';
      this.loadLogs();
    }
  }
};
</script>
