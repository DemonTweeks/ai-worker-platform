<template>
  <section class="panel">
    <h2>Upload New Version</h2>
    <div class="admin-form-grid">
      <label>
        <span class="field-label">Asset Type</span>
        <select v-model="assetType" :disabled="loading">
          <option value="pr_model">PR Model</option>
          <option value="contract_info">Contract Info</option>
          <option value="ecc_template">ECC Template</option>
        </select>
      </label>
      <label>
        <span class="field-label">Excel File</span>
        <input type="file" accept=".xlsx,.xls" :disabled="loading" @change="onFileChange" />
      </label>
      <LoadingButton
        label="Upload Asset"
        loading-text="Uploading..."
        :loading="loading"
        :disabled="!file || !assetType"
        @click="submit"
      />
    </div>
    <p v-if="lastUploaded" class="success-text">Uploaded version {{ lastUploaded.version }}.</p>
  </section>
</template>

<script>
import LoadingButton from '../LoadingButton.vue';

export default {
  name: 'AssetUploadForm',
  components: { LoadingButton },
  props: {
    loading: { type: Boolean, default: false },
    lastUploaded: { type: Object, default: null }
  },
  data() {
    return {
      assetType: 'pr_model',
      file: null
    };
  },
  methods: {
    onFileChange(event) {
      this.file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    },
    submit() {
      this.$emit('upload', {
        assetType: this.assetType,
        file: this.file
      });
    }
  }
};
</script>
