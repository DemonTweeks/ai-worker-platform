<template>
  <section class="panel">
    <h2>Audit Logs</h2>
    <div v-if="logs.length === 0" class="empty-state">No audit logs found.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Asset Type</th>
            <th>Version</th>
            <th>Status</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(log, index) in logs" :key="`${log.timestamp}-${index}`">
            <td>{{ formatDateTime(log.timestamp) }}</td>
            <td>{{ log.admin || 'unknown' }}</td>
            <td>{{ log.action || 'unknown' }}</td>
            <td>{{ log.assetType || 'N/A' }}</td>
            <td>{{ log.version || 'N/A' }}</td>
            <td>
              <span class="badge" :class="log.status === 'success' ? 'badge-success' : 'badge-danger'">
                {{ log.status || 'unknown' }}
              </span>
            </td>
            <td>{{ log.ip || 'N/A' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';

export default {
  name: 'AuditLogTable',
  props: {
    logs: { type: Array, default: () => [] }
  },
  methods: {
    formatDateTime
  }
};
</script>
