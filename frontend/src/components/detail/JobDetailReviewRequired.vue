<template>
  <section class="panel">
    <h2>REVIEW_REQUIRED</h2>
    <div v-if="items.length === 0" class="empty-state">No review-required items were recorded.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Site Code</th>
            <th>Scope</th>
            <th>Subcon</th>
            <th>Issue</th>
            <th>Severity</th>
            <th>Description</th>
            <th>Source Row</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id || `${item.siteCode}-${item.issueType}-${item.createdAt}`">
            <td>{{ item.siteCode || 'N/A' }}</td>
            <td>{{ item.scope || 'N/A' }}</td>
            <td>{{ item.subcon || 'N/A' }}</td>
            <td>{{ item.issueType || 'review_required' }}</td>
            <td>{{ item.severity || 'N/A' }}</td>
            <td>{{ item.description || 'No description.' }}</td>
            <td>{{ item.sourceRow || 'N/A' }}</td>
            <td>{{ formatDateTime(item.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { formatDateTime } from '../../utils/formatUtils';

export default {
  name: 'JobDetailReviewRequired',
  props: {
    items: { type: Array, default: () => [] }
  },
  methods: {
    formatDateTime
  }
};
</script>
