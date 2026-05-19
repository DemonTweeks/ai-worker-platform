<template>
  <section class="panel compact-panel">
    <div class="panel-heading">
      <span class="step-marker">3</span>
      <h2>Sites</h2>
    </div>

    <div class="radio-row">
      <label>
        <input type="radio" value="all_sites" :checked="mode === 'all_sites'" @change="$emit('mode-change', 'all_sites')" />
        All sites
      </label>
      <label>
        <input type="radio" value="site_code" :checked="mode === 'site_code'" @change="$emit('mode-change', 'site_code')" />
        Specific site codes
      </label>
    </div>

    <textarea
      v-if="mode === 'site_code'"
      :value="siteCodesText"
      rows="5"
      placeholder="B00577, K00340"
      @input="$emit('site-codes-change', $event.target.value)"
    />
    <p v-if="mode === 'site_code'" class="muted">{{ parsedCount }} unique site code(s)</p>
  </section>
</template>

<script>
export default {
  name: 'SiteSelector',
  props: {
    mode: { type: String, default: 'site_code' },
    siteCodesText: { type: String, default: '' }
  },
  computed: {
    parsedCount() {
      return this.siteCodesText
        .split(/[\s,]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .filter((item, index, items) => items.indexOf(item) === index)
        .length;
    }
  }
};
</script>
