<template>
  <section class="panel">
    <h2>Asset Versions Used</h2>
    <div v-if="entries.length === 0" class="empty-state">Asset versions are not available for this job.</div>
    <div v-else class="asset-version-list">
      <span v-for="entry in entries" :key="entry.name">
        <small>{{ entry.label }}</small>
        <strong>{{ entry.value }}</strong>
      </span>
    </div>
  </section>
</template>

<script>
export default {
  name: 'JobDetailAssetVersions',
  props: {
    assetVersions: { type: Object, default: () => ({}) }
  },
  computed: {
    entries() {
      const labels = {
        prModel: 'PR Model',
        eccTemplate: 'ECC Template'
      };

      return Object.keys(this.assetVersions || {})
        .filter((name) => this.assetVersions[name])
        .map((name) => ({
          name,
          label: labels[name] || name,
          value: this.assetVersions[name]
        }));
    }
  }
};
</script>
