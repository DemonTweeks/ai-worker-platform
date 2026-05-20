<template>
  <section class="panel">
    <div class="panel-heading">
      <span class="step-marker">1</span>
      <h2>Upload & Validate</h2>
    </div>

    <label class="field-label" for="iepms-file">Source file (iEPMS export)</label>
    <p class="field-hint">Accepted file types: .xlsx, .xls, .csv. Maximum recommended size: 25 MB.</p>
    <input
      id="iepms-file"
      class="upload-input"
      type="file"
      accept=".xlsx,.xls,.csv"
      :disabled="loading || disableAction"
      @change="onFileChange"
    />

    <div v-if="fileName" class="file-state">
      <span class="meta-label">Selected file</span>
      <strong>{{ fileName }}</strong>
      <button type="button" class="tertiary-action" @click="clearFile">Clear</button>
    </div>
    <p v-else class="muted">Upload is not started. Select a valid file to begin.</p>

    <LoadingButton
      label="Validate File"
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
    disableAction: { type: Boolean, default: false }
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
