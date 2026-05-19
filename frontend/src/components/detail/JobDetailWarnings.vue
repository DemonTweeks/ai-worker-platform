<template>
  <section class="panel">
    <h2>Warnings</h2>
    <div v-if="warnings.length === 0" class="empty-state">No warnings were recorded.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Site Code</th>
            <th>Description</th>
            <th>Source Row</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="warning in warnings" :key="warning._id || `${warning.warningType}-${warning.siteCode}-${warning.createdAt}`">
            <td>{{ warning.warningType || 'warning' }}</td>
            <td>{{ warning.siteCode || 'N/A' }}</td>
            <td>{{ warning.description || 'No description.' }}</td>
            <td>{{ warning.sourceRow || 'N/A' }}</td>
            <td>{{ formatDateTime(warning.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';

export default {
  name: 'JobDetailWarnings',
  props: {
    warnings: { type: Array, default: () => [] }
  },
  methods: {
    formatDateTime
  }
};
</script>
