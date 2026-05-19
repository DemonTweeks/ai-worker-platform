<template>
  <section class="panel history-filters">
    <div class="filter-grid">
      <label>
        <span class="field-label">Search</span>
        <input
          :value="value.search"
          placeholder="Job ID or file name"
          @input="update('search', $event.target.value)"
        />
      </label>
      <label>
        <span class="field-label">Status</span>
        <select :value="value.status" @change="update('status', $event.target.value)">
          <option value="">All statuses</option>
          <option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
      </label>
      <label>
        <span class="field-label">PR Scope</span>
        <select :value="value.prScope" @change="update('prScope', $event.target.value)">
          <option value="">All scopes</option>
          <option value="TSS">TSS</option>
          <option value="TI">TI</option>
        </select>
      </label>
      <label>
        <span class="field-label">From</span>
        <input type="date" :value="value.dateFrom" @input="update('dateFrom', $event.target.value)" />
      </label>
      <label>
        <span class="field-label">To</span>
        <input type="date" :value="value.dateTo" @input="update('dateTo', $event.target.value)" />
      </label>
      <label>
        <span class="field-label">Sort</span>
        <select :value="value.sortBy" @change="update('sortBy', $event.target.value)">
          <option value="createdAt_desc">Newest first</option>
          <option value="createdAt_asc">Oldest first</option>
          <option value="status_asc">Status A-Z</option>
        </select>
      </label>
    </div>
    <div class="filter-actions">
      <button type="button" @click="$emit('apply')">Apply</button>
      <button type="button" class="secondary-button" @click="$emit('reset')">Reset</button>
    </div>
  </section>
</template>

<script>
import { STATUS_LABELS } from '../../utils/jobStatusUtils';

export default {
  name: 'JobHistoryFilters',
  props: {
    value: { type: Object, required: true }
  },
  computed: {
    statuses() {
      return Object.keys(STATUS_LABELS).map((value) => ({ value, label: STATUS_LABELS[value] }));
    }
  },
  methods: {
    update(key, nextValue) {
      this.$emit('input', {
        ...this.value,
        [key]: nextValue
      });
    }
  }
};
</script>
