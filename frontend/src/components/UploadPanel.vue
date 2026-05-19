<template>
  <section class="panel">
    <div class="panel-heading">
      <span class="step-marker">1</span>
      <h2>Upload and Prevalidate</h2>
    </div>

    <label class="field-label" for="iepms-file">iEPMS export</label>
    <input id="iepms-file" type="file" accept=".xlsx,.xls,.csv" @change="onFileChange" />
    <p v-if="fileName" class="muted">{{ fileName }}</p>

    <LoadingButton
      label="Prevalidate"
      loading-text="Validating..."
      :loading="loading"
      :disabled="!file"
      @click="$emit('prevalidate', file)"
    />

    <div v-if="result" class="checklist" :class="{ 'is-pass': result.passed, 'is-fail': !result.passed }">
      <strong>{{ result.passed ? 'Prevalidation passed' : 'Prevalidation failed' }}</strong>
      <ul>
        <li v-for="item in result.checklist" :key="item.name || item.label">
          {{ item.name || item.label }}: {{ item.passed ? 'Passed' : 'Failed' }}
        </li>
      </ul>
      <p v-if="result.workerExplanation">{{ result.workerExplanation }}</p>
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
    loading: { type: Boolean, default: false }
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
    }
  }
};
</script>
