<template>
  <section class="panel">
    <div class="panel-heading">
      <h2 class="upload-validate">{{ title }}</h2>
    </div>

    <div v-if="!fileName">
      <label class="field-label" :for="inputId">{{ inputLabel }}</label>
      <p class="field-hint">{{ inputHint }}</p>
      <input
        :id="inputId"
        class="upload-input"
        type="file"
        :accept="accept"
        :disabled="loading || disableAction"
        @change="onFileChange"
      />
    </div>
    
    <div v-if="fileName" class="file-state">
      <span class="meta-label">Selected file</span>
      <strong>{{ fileName }}</strong>
      <button type="button" class="tertiary-action" @click="clearFile">Clear</button>
    </div>
    <p v-else class="muted">Upload is not started. Select a valid file to begin.</p>

    <LoadingButton
      :label="validateLabel"
      loading-text="Validating..."
      :loading="loading"
      :disabled="!file || disableAction"
      @click="$emit('prevalidate', file)"
    />

    <div v-if="loading" class="skeleton-row">Validation is running</div>

    <div v-if="result" class="checklist" :class="{ 'is-pass': result.passed, 'is-fail': !result.passed }">
      <strong>{{ result.passed ? 'Prevalidation passed' : 'Prevalidation failed' }}</strong>
      <ul v-if="result.checklist && result.checklist.length">
        <li v-for="item in result.checklist" :key="item.name || item.label">
          {{ item.name || item.label }}: {{ item.passed ? 'Passed' : 'Failed' }}
        </li>
      </ul>
      <p v-if="result.workerExplanation" class="muted">{{ result.workerExplanation }}</p>
    </div>
  </section>
</template>

<script>
import LoadingButton from './LoadingButton.vue';

export default {
  name: 'UploadPanel',
  components: { LoadingButton },
  props: {
    result: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    disableAction: { type: Boolean, default: false },
    title: { type: String, default: 'Upload & Validate' },
    inputId: { type: String, default: 'iepms-file' },
    inputLabel: { type: String, default: 'Source file (iEPMS export)' },
    inputHint: { type: String, default: 'Accepted file types: .xlsx, .xls, .csv. Maximum recommended size: 25 MB.' },
    validateLabel: { type: String, default: 'Validate File' },
    accept: { type: String, default: '.xlsx,.xls,.csv' }
  },
  data() {
    return {
      file: null
    };
  },
  computed: {
    fileName() {
      return this.file ? this.file.name : '';
    }
  },
  methods: {
    onFileChange(event) {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      this.file = file;
      this.$emit('file-selected', file);
    },
    clearFile() {
      this.file = null;
      this.$emit('file-selected', null);
    }
  }
};
</script>
