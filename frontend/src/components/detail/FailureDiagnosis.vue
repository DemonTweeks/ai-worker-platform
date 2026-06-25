<template>
  <section v-if="isFailed && failureDiagnosis" class="panel failure-diagnosis-panel">
    <h2>Failure Diagnosis</h2>

    <!-- PREFLIGHT_FAILED -->
    <div v-if="failureDiagnosis.category === 'PREFLIGHT_FAILED'" class="diagnosis-content">
      <h3 class="diagnosis-title text-danger">{{ failureDiagnosis.title }}</h3>

      <div v-if="missingPackagesList" class="diagnosis-item">
        <span class="label">Missing Package(s):</span>
        <span class="value font-semibold">{{ missingPackagesList }}</span>
      </div>

      <div v-if="failureDiagnosis.pythonExecutable" class="diagnosis-item">
        <span class="label">Actual Python Executable:</span>
        <code class="code-block">{{ failureDiagnosis.pythonExecutable }}</code>
      </div>

      <div v-if="failureDiagnosis.recommendedCommand" class="diagnosis-item command-box">
        <span class="label">Recommended Repair Command:</span>
        <div class="command-container">
          <code class="command-text">{{ failureDiagnosis.recommendedCommand }}</code>
          <button type="button" class="action-button copy-btn" @click="copyCommand">
            {{ copied ? 'Copied!' : 'Copy Command' }}
          </button>
        </div>
      </div>
    </div>

    <!-- WORKER_TIMEOUT -->
    <div v-else-if="failureDiagnosis.category === 'WORKER_TIMEOUT'" class="diagnosis-content">
      <h3 class="diagnosis-title text-danger">{{ failureDiagnosis.title }}</h3>
      <p class="explanation-text">
        {{ failureDiagnosis.summary }}
      </p>
      <p class="instruction-text">
        Please check the Job History / Job Detail state to verify if resources or limits need adjustment.
      </p>
    </div>

    <!-- WORKER_PROCESS_FAILED -->
    <div v-else-if="failureDiagnosis.category === 'WORKER_PROCESS_FAILED'" class="diagnosis-content">
      <h3 class="diagnosis-title text-danger">{{ failureDiagnosis.title }}</h3>
      <p class="explanation-text">
        {{ failureDiagnosis.summary }}
      </p>
      <div v-if="failureDiagnosis.scope" class="diagnosis-item">
        <span class="label">Execution Scope:</span>
        <strong class="value">{{ failureDiagnosis.scope }}</strong>
      </div>
      <div v-if="failureDiagnosis.exitCode !== null && failureDiagnosis.exitCode !== undefined" class="diagnosis-item">
        <span class="label">Exit Code:</span>
        <code class="code-block">{{ failureDiagnosis.exitCode }}</code>
      </div>
    </div>

    <!-- Generic Error -->
    <div v-else class="diagnosis-content">
      <h3 class="diagnosis-title text-danger">{{ failureDiagnosis.title }}</h3>
      <p class="explanation-text">{{ failureDiagnosis.summary }}</p>
    </div>

    <!-- Technical details section for any failure with stderr -->
    <div v-if="failureDiagnosis.technicalDetails" class="technical-details-wrapper">
      <details class="tech-details">
        <summary class="tech-details-summary">Technical details</summary>
        <div class="tech-details-content">
          <pre class="stderr-output"><code>{{ failureDiagnosis.technicalDetails }}</code></pre>
        </div>
      </details>
    </div>
  </section>
</template>

<script>
export default {
  name: 'FailureDiagnosis',
  props: {
    job: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      copied: false
    };
  },
  computed: {
    isFailed() {
      return this.job && this.job.status === 'failed';
    },
    failureDiagnosis() {
      return this.job && this.job.failureDiagnosis ? this.job.failureDiagnosis : null;
    },
    missingPackagesList() {
      const pkgs = this.failureDiagnosis && this.failureDiagnosis.missingPackages;
      if (Array.isArray(pkgs) && pkgs.length > 0) {
        return pkgs.join(', ');
      }
      return '';
    }
  },
  methods: {
    async copyCommand() {
      if (!this.failureDiagnosis || !this.failureDiagnosis.recommendedCommand) return;
      try {
        await navigator.clipboard.writeText(this.failureDiagnosis.recommendedCommand);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy command: ', err);
      }
    }
  }
};
</script>

<style scoped>
.failure-diagnosis-panel {
  border-left: 4px solid var(--danger);
  margin-top: 20px;
  padding: 20px;
}

.diagnosis-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 16px;
}

.text-danger {
  color: var(--danger);
}

.diagnosis-content {
  margin-bottom: 16px;
}

.diagnosis-item {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (min-width: 600px) {
  .diagnosis-item {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
}

.label {
  font-weight: 600;
  color: var(--text-muted);
  min-width: 180px;
}

.value {
  color: var(--text);
}

.font-semibold {
  font-weight: 600;
}

.code-block {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: monospace;
  font-size: 0.9em;
  word-break: break-all;
}

.command-box {
  background: var(--panel-tint);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-top: 14px;
}

.command-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

@media (min-width: 768px) {
  .command-container {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.command-text {
  font-family: monospace;
  font-size: 0.95em;
  background: rgba(0, 0, 0, 0.04);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  flex-grow: 1;
  word-break: break-all;
}

.copy-btn {
  background: linear-gradient(180deg, var(--blue), #0b5f9f);
  color: white;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: linear-gradient(180deg, #147bc8, #0a548e);
}

.explanation-text {
  font-size: 1rem;
  color: var(--text);
  margin-bottom: 8px;
}

.instruction-text {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.technical-details-wrapper {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.tech-details {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  overflow: hidden;
}

.tech-details-summary {
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--panel-tint);
  user-select: none;
  transition: background-color 0.2s ease;
}

.tech-details-summary:hover {
  background: #e2f2fb;
}

.tech-details-content {
  padding: 14px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.stderr-output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9em;
  color: #333;
  max-height: 300px;
  overflow-y: auto;
}
</style>
