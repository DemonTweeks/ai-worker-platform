<template>
  <section class="panel">
    <div class="section-title-row">
      <div>
        <p class="eyebrow">{{ title }}</p>
        <h2>{{ activeVersionText }}</h2>
      </div>
      <span class="scope-badge">{{ assets.length }} version(s)</span>
    </div>
    <div v-if="assets.length === 0" class="empty-state">No versions uploaded yet.</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Version</th>
            <th>File</th>
            <th>Size</th>
            <th>Uploaded By</th>
            <th>Uploaded</th>
            <th>Activated</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in assets" :key="asset.id || asset.version">
            <td>{{ asset.version }}</td>
            <td>{{ asset.fileName }}</td>
            <td>{{ formatBytes(asset.fileSize) }}</td>
            <td>{{ asset.uploadedBy || 'unknown' }}</td>
            <td>{{ formatDateTime(asset.uploadedAt) }}</td>
            <td>{{ formatDateTime(asset.activatedAt) }}</td>
            <td>
              <span v-if="asset.isActive" class="badge badge-success">Active</span>
              <span v-else-if="asset.fileAvailable" class="badge badge-muted">Inactive</span>
              <span v-else class="badge badge-danger">File Missing</span>
            </td>
            <td>
              <button
                v-if="!asset.isActive"
                type="button"
                class="secondary-button"
                :disabled="activatingVersion === asset.version || !asset.fileAvailable"
                @click="$emit('activate', asset)"
              >
                Activate
              </button>
              <span v-else class="muted">Current</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { formatBytes, formatDateTime } from '../../utils/formatUtils';

const LABELS = {
  pr_model: 'PR Model versions',
  ecc_template: 'ECC Template versions'
};

export default {
  name: 'AssetVersionTable',
  props: {
    assetType: { type: String, required: true },
    assets: { type: Array, default: () => [] },
    activeVersion: { type: String, default: '' },
    activatingVersion: { type: String, default: '' }
  },
  computed: {
    title() {
      return LABELS[this.assetType] || this.assetType;
    },
    activeVersionText() {
      return this.activeVersion ? `Active: ${this.activeVersion}` : 'No active version';
    }
  },
  methods: {
    formatBytes,
    formatDateTime
  }
};
</script>
