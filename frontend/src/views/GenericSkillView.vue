<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="displayError"
      :dismissible="Boolean(displayError)"
      @dismiss="dismissAllErrors"
    />

    <section class="workbench-hero" :aria-label="`${skillDisplayName} workbench`">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>{{ heroTitle }}</h2>
        <p class="workbench-subtitle">{{ heroSubtitle }}</p>

        <div class="workbench-chip-row" aria-label="Workflow status">
          <span class="workbench-chip">{{ skillDisplayName }}</span>
          <span class="workbench-chip">Approved package</span>
          <span class="workbench-chip">Standalone Python</span>
          <span class="workbench-chip">{{ healthLabel }}</span>
        </div>

        <div class="workbench-action-row" aria-label="Primary actions">
          <a class="workbench-primary-link" href="#worker-workbench" @click.prevent="scrollToWorkbench">Configure Job</a>
          <router-link class="workbench-secondary-link" to="/history">View Job History</router-link>
        </div>
      </div>

      <section id="worker-workbench" ref="workbench" class="workbench-surface" :aria-label="`${skillDisplayName} workflow`">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Operational Workflow</p>
            <h3>{{ skillDisplayName }}</h3>
          </div>
          <span class="workbench-status-pill">{{ statusLabel }}</span>
        </div>

        <div v-if="loading" class="status-banner">Loading the approved skill contract...</div>

        <form v-else-if="skill" class="workbench-form" @submit.prevent="submit">
          <div class="workbench-main-grid">
            <div class="workbench-upload-stack">
              <section
                v-for="input in skill.inputs.files"
                :key="input.name"
                class="panel cockpit-card upload-card workbench-upload-card"
              >
                <div class="panel-heading">
                  <h2 class="upload-validate">{{ uploadTitle(input.name) }}</h2>
                </div>

                <div v-if="!hasSelectedFile(input.name)">
                  <label class="field-label" :for="inputId(input.name)">
                    {{ labelFor(input.name) }}<strong v-if="input.required"> *</strong>
                  </label>
                  <p class="field-hint">
                    {{ input.multiple ? 'Select one or more source files.' : 'Select the source file.' }}
                    Accepted: {{ input.acceptedExtensions.join(', ') }}
                  </p>
                  <input
                    :id="inputId(input.name)"
                    :key="`${input.name}-${inputResetKeys[input.name] || 0}`"
                    class="upload-input"
                    type="file"
                    :accept="input.acceptedExtensions.join(',')"
                    :multiple="input.multiple"
                    :required="input.required"
                    :disabled="submitting"
                    @change="selectFiles(input, $event)"
                  >
                </div>

                <div v-else class="file-state">
                  <span class="meta-label">Selected file{{ input.multiple ? 's' : '' }}</span>
                  <strong class="file-state-name">{{ selectedFileLabel(input.name) }}</strong>
                  <div class="workbench-action-row file-state-actions">
                    <button type="button" class="tertiary-action" :disabled="submitting" @click="clearFiles(input.name)">
                      Remove
                    </button>
                  </div>
                </div>

                <p v-if="!hasSelectedFile(input.name)" class="muted">
                  Upload is not started. Validation runs inside the approved skill after submission.
                </p>
              </section>
            </div>

            <section class="panel cockpit-card workbench-config-card">
              <div class="cockpit-card-heading">
                <span>Launch Configuration</span>
                <small>Manifest-defined</small>
              </div>

              <div v-if="parameterEntries.length" class="workbench-config-grid">
                <div v-for="entry in parameterEntries" :key="entry.name" class="cockpit-field-group">
                  <span class="field-label">
                    {{ labelFor(entry.name) }}<strong v-if="entry.required"> *</strong>
                  </span>

                  <div v-if="entry.rule.enum" class="segmented compact-segmented">
                    <button
                      v-for="option in entry.rule.enum"
                      :key="option"
                      type="button"
                      :class="{ active: parameterValues[entry.name] === option }"
                      :disabled="submitting"
                      @click="$set(parameterValues, entry.name, option)"
                    >
                      {{ labelFor(option) }}
                    </button>
                  </div>

                  <label v-else-if="entry.rule.type === 'boolean'" class="cockpit-empty-card">
                    <input v-model="parameterValues[entry.name]" type="checkbox" :disabled="submitting">
                    {{ parameterValues[entry.name] ? 'Enabled' : 'Disabled' }}
                  </label>

                  <textarea
                    v-else-if="entry.rule.type === 'array'"
                    v-model="parameterValues[entry.name]"
                    class="cockpit-sites-input"
                    rows="5"
                    placeholder="One value per line"
                    :required="entry.required"
                    :disabled="submitting"
                  ></textarea>

                  <input
                    v-else
                    v-model="parameterValues[entry.name]"
                    class="cockpit-sites-input"
                    :type="entry.rule.type === 'integer' ? 'number' : 'text'"
                    :min="entry.rule.minimum"
                    :max="entry.rule.maximum"
                    :required="entry.required"
                    :disabled="submitting"
                  >
                </div>
              </div>

              <div v-else class="cockpit-empty-card">
                This package does not require launch parameters.
              </div>

              <div class="cockpit-empty-card">
                The platform transports these inputs without interpreting workbook or business content.
              </div>

              <div class="workbench-create-row">
                <button type="submit" class="action-button" :disabled="submitting || !canSubmit">
                  {{ submitting ? 'Creating...' : 'Create Job' }}
                </button>
                <p v-if="!canSubmit" class="cockpit-note">Select every required input before creating the Job.</p>
                <p v-else class="cockpit-ready">Ready to create Job</p>
              </div>
            </section>
          </div>

          <section class="panel cockpit-card workbench-result-card">
            <div class="cockpit-card-heading">
              <span>Active Jobs</span>
              <small>{{ visibleActiveSessionJobs.length }} active</small>
            </div>
            <div v-if="visibleActiveSessionJobs.length === 0" class="cockpit-empty-card">
              No active jobs are running or queued in this browser tab.
            </div>
            <div v-else class="download-compact">
              <table class="active-jobs-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Worker</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>View</th>
                    <th>Stop/Cancel</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="job in visibleActiveSessionJobs"
                    :key="job.jobId"
                    :class="{ selected: job.jobId === currentJobId }"
                  >
                    <td>{{ job.jobId }}</td>
                    <td>{{ job.workerDisplayName || job.workerId }}</td>
                    <td>{{ job.status }}</td>
                    <td>
                      <time class="job-created-time" :datetime="job.createdAt || null">
                        {{ formatCompactDateTime(job.createdAt, 'Just now') }}
                      </time>
                    </td>
                    <td>
                      <button type="button" class="secondary-link" @click="viewLiveOutput(job.jobId)">View</button>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="secondary-link"
                        :disabled="!isJobCancellable(job)"
                        @click="prepareCancellationForJob(job.jobId)"
                      >
                        {{ job.status === 'cancelling' ? 'Stopping...' : 'Stop / Cancel' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section ref="cancellationPanel" class="panel cockpit-card workbench-result-card">
            <div class="cockpit-card-heading">
              <span>Result Delivery</span>
              <small>{{ outputCount }} output(s)</small>
            </div>
            <div v-if="!currentJobId" class="cockpit-empty-card">
              Create a Job to enable result delivery.
            </div>
            <div v-else class="download-compact">
              <p class="cockpit-note">Job: <strong>{{ currentJobId }}</strong></p>
              <div class="download-progress">
                <div class="download-progress-topline">
                  <span>{{ downloadProgressLabel }}</span>
                  <strong>{{ downloadProgressPercent !== null ? `${downloadProgressPercent}%` : progressStateLabel }}</strong>
                </div>
                <div
                  class="download-progress-track"
                  :class="{ indeterminate: downloadProgressPercent === null && currentJobId && !jobReady }"
                >
                  <span :style="{ width: `${downloadProgressPercent !== null ? downloadProgressPercent : 100}%` }"></span>
                </div>
              </div>
              <dl class="download-summary-grid">
                <div v-for="item in downloadSummaryItems" :key="item.label">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
              <p v-if="jobReady" class="completion-message" :class="resultTone">{{ resultCompletionMessage }}</p>
              <div v-if="hasActiveWorkerJob" class="workbench-create-row">
                <button
                  v-if="!showCancelForm"
                  type="button"
                  class="secondary-link"
                  :disabled="cancellingRequest || currentStatus === 'cancelling'"
                  @click="showCancelForm = true"
                >
                  {{ currentStatus === 'cancelling' ? 'Stopping...' : 'Stop Job' }}
                </button>
                <div v-else class="cockpit-field-group">
                  <label class="field-label" for="cancel-reason">Cancellation reason</label>
                  <select
                    id="cancel-reason"
                    ref="cancelReasonSelect"
                    class="cockpit-sites-input compact-inline-select"
                    :disabled="cancellingRequest"
                    :value="cancelReasonCode"
                    @change="cancelReasonCode = $event.target.value"
                  >
                    <option value="requested_by_user">Requested by user</option>
                    <option value="wrong_inputs">Wrong inputs selected</option>
                    <option value="started_by_mistake">Started by mistake</option>
                    <option value="long_running">Taking too long</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    v-if="cancelReasonCode === 'other'"
                    class="cockpit-sites-input"
                    :disabled="cancellingRequest"
                    :value="cancelReasonText"
                    maxlength="160"
                    placeholder="Optional short note"
                    @input="cancelReasonText = $event.target.value"
                  >
                  <div class="workbench-action-row">
                    <button type="button" class="workbench-secondary-link" :disabled="cancellingRequest" @click="submitCancellationRequest">
                      {{ cancellingRequest ? 'Stopping...' : 'Confirm Stop Job' }}
                    </button>
                    <button type="button" class="secondary-link" :disabled="cancellingRequest" @click="resetCancellationForm">
                      Keep Running
                    </button>
                  </div>
                </div>
                <p class="cockpit-note">The active Job can be stopped without moving domain logic into the platform.</p>
              </div>
              <a v-if="canDownload" class="download-button" :href="downloadUrl">{{ downloadButtonLabel }}</a>
              <p v-if="deliveryWarningMessage" class="cockpit-note">{{ deliveryWarningMessage }}</p>
              <p v-else-if="!canDownload" class="cockpit-note">{{ downloadUnavailableMessage }}</p>
            </div>
          </section>

          <section v-if="showOptionalHandoff" class="panel cockpit-card workbench-result-card">
            <div class="cockpit-card-heading">
              <span>Execution Handoff</span>
              <small>Thin wrapper</small>
            </div>
            <div class="cockpit-empty-card">
              The server validates the package contract, queues the request, and starts its Python entrypoint. The skill owns technical validation, business rules, and output generation.
            </div>
          </section>

          <section v-if="showLegacyControls" class="panel cockpit-card workbench-result-card" aria-hidden="true">
            <div class="audit-period-card audit-period-grid">
              <div class="workbench-sites-field"></div>
              <ol class="audit-flow-list"></ol>
            </div>
            Legacy prevalidation and domain-mode controls are hidden because they are owned by standalone skills.
          </section>
        </form>
      </section>
    </section>

    <form class="cockpit-command workbench-command" @submit.prevent="submitCommand">
      <label class="field-label" for="cockpit-command-input">AI Chatbox</label>
      <div class="command-input-row">
        <input
          id="cockpit-command-input"
          v-model="commandText"
          type="text"
          placeholder="Ask about this Job, paste a site code, or request an explanation"
          autocomplete="off"
        >
        <button type="submit" :disabled="asking || !commandText.trim()">
          {{ asking ? 'Asking...' : 'Send' }}
        </button>
      </div>
      <p v-if="commandNotice" class="cockpit-note">{{ commandNotice }}</p>
    </form>

    <section id="worker-console" ref="workerConsole" class="cockpit-console-shell">
      <div class="console-title-row">
        <div>
          <p class="eyebrow">Live Output</p>
          <h2>Worker Console</h2>
        </div>
        <div class="console-meta">
          <span>{{ connectionStatus }}</span>
          <span>{{ formatDateTime(updatedAt, 'No live update yet') }}</span>
        </div>
      </div>

      <div ref="consoleBody" class="cockpit-console" @scroll="onConsoleScroll">
        <article
          v-for="(item, index) in consoleItems"
          :key="item.id"
          class="console-entry"
          :class="[{ 'is-faded': index < consoleItems.length - 4 }, `entry-${item.tone}`]"
        >
          <div class="console-entry-meta">
            <span>{{ item.label }}</span>
            <time :datetime="item.time || null">{{ formatDateTime(item.time, 'Current session') }}</time>
          </div>
          <div class="console-message-bubble">
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
            <small v-if="item.meta" class="console-message-meta">{{ item.meta }}</small>
            <router-link
              v-if="item.outputJobId"
              class="workbench-primary-link console-output-link"
              :to="{ name: 'job-detail', params: { jobId: item.outputJobId } }"
            >
              View &amp; Download Outputs
            </router-link>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script>
import ErrorBanner from '../components/ErrorBanner.vue';
import {
  createSkillJob,
  getErrorMessage,
  getFileDownloadUrl,
  getZipDownloadUrl,
  listSkills
} from '../api/jobApi';
import { workerRuntimeMixin } from './shared/workerRuntime';

const randomId = (prefix) => {
  const random = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};

const HERO_CONTENT = {
  'create-pr-cd': {
    title: 'Launch PR Creator jobs with controlled source inputs.',
    subtitle: 'Configure the approved MW PR skill, submit its source workbook, and continue to dedicated Job progress and result delivery.'
  },
  'create-pr-cd-ran': {
    title: 'Launch PR Creator jobs for RAN workflows.',
    subtitle: 'Submit BOM and EPMS inputs to the approved RAN package while its Python runtime owns project validation, calculation, and workbook generation.'
  },
  'tx-pr-auditor': {
    title: 'Run controlled PR audits from approved inputs.',
    subtitle: 'Submit Final PO and expected ECC workbooks to the standalone auditor, then review progress and evidence through the shared Job workflow.'
  }
};

const UPLOAD_TITLES = {
  site_data: 'Source Data Upload',
  bom: 'BOM Upload',
  epms: 'EPMS Upload',
  final_po: 'Final PO Upload',
  expected_ecc: 'Expected ECC Upload'
};

export default {
  name: 'GenericSkillView',
  mixins: [workerRuntimeMixin],
  components: { ErrorBanner },
  props: {
    skillId: { type: String, required: true }
  },
  data() {
    return {
      skill: null,
      loading: true,
      submitting: false,
      error: '',
      selectedFiles: {},
      inputResetKeys: {},
      parameterValues: {},
      showLegacyControls: false,
      showOptionalHandoff: false
    };
  },
  computed: {
    skillDisplayName() {
      return this.skill ? this.skill.displayName : 'Loading skill...';
    },
    heroTitle() {
      return HERO_CONTENT[this.skillId]?.title || `Launch ${this.skillDisplayName} jobs.`;
    },
    heroSubtitle() {
      return HERO_CONTENT[this.skillId]?.subtitle || 'Submit approved inputs through the shared Job workflow.';
    },
    statusLabel() {
      if (this.loading) return 'Loading';
      if (this.error) return 'Unavailable';
      if (this.submitting) return 'Creating';
      return 'Ready';
    },
    displayError() {
      return this.error || this.errorMessage;
    },
    activeJobWorkerType() {
      return 'skill';
    },
    activeJobWorkerId() {
      return this.skillId;
    },
    activeWorkerLabel() {
      return this.skillDisplayName;
    },
    activeModeLabel() {
      return this.parameterValues.scope || this.parameterValues.runMode || 'Manifest contract';
    },
    parameterEntries() {
      if (!this.skill) return [];
      const schema = this.skill.inputs.parametersSchema || {};
      const required = new Set(schema.required || []);
      return Object.entries(schema.properties || {}).map(([name, rule]) => ({ name, rule, required: required.has(name) }));
    },
    canSubmit() {
      if (!this.skill) return false;
      return this.skill.inputs.files.every((input) => !input.required || this.hasSelectedFile(input.name));
    },
    primaryDownloadFile() {
      if (!this.jobDetail || !Array.isArray(this.jobDetail.outputs)) return null;
      if (this.skillId === 'tx-pr-auditor') {
        return this.jobDetail.outputs.find((file) => file.available && /\.xlsx$/i.test(file.fileName || '')) || null;
      }
      return this.jobDetail.outputs.find((file) => file.available) || null;
    },
    canDownload() {
      return Boolean(this.primaryDownloadFile);
    },
    downloadUrl() {
      if (!this.currentJobId) return '#';
      if (this.skillId === 'tx-pr-auditor' && this.primaryDownloadFile) {
        return getFileDownloadUrl(this.currentJobId, this.primaryDownloadFile.id);
      }
      return getZipDownloadUrl(this.currentJobId);
    },
    downloadButtonLabel() {
      return this.skillId === 'tx-pr-auditor' ? 'Download Audit Report' : 'Download ZIP';
    },
    downloadUnavailableMessage() {
      if (!this.currentJobId) return 'Create a Job to enable downloads.';
      return this.jobReady ? 'No downloadable output was produced.' : 'Output is not available yet.';
    },
    consoleItems() {
      const items = [{
        id: 'session-ready',
        label: 'Workbench',
        title: `Ready for ${this.skillDisplayName}`,
        body: 'Select the manifest-defined inputs, create a Job, then track progress, AI responses, and outputs here.',
        tone: 'info',
        time: ''
      }];
      Object.entries(this.selectedFiles).forEach(([name, selected]) => {
        if (!this.hasSelectedFile(name)) return;
        items.push({
          id: `file-${name}`,
          label: 'Upload',
          title: `${this.labelFor(name)} selected`,
          body: this.selectedFileLabel(name),
          tone: 'info',
          time: ''
        });
      });
      return [...items, ...this.buildSharedConsoleItems()];
    }
  },
  watch: {
    skillId: 'loadSkill',
    consoleItems() {
      this.$nextTick(() => this.scrollConsoleToBottom(false));
    }
  },
  mounted() {
    this.loadSkill();
  },
  methods: {
    dismissAllErrors() {
      this.error = '';
      this.dismissErrorMessage();
    },
    scrollToWorkbench() {
      if (this.$refs.workbench && typeof this.$refs.workbench.scrollIntoView === 'function') {
        this.$refs.workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    labelFor(value) {
      return String(value).replace(/_/g, ' ').replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
    },
    uploadTitle(name) {
      return UPLOAD_TITLES[name] || `${this.labelFor(name)} Upload`;
    },
    inputId(name) {
      return `skill-input-${this.skillId}-${name}`;
    },
    hasSelectedFile(name) {
      const selected = this.selectedFiles[name];
      return Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
    },
    selectedFileLabel(name) {
      const selected = this.selectedFiles[name];
      const values = Array.isArray(selected) ? selected : [selected];
      return values.filter(Boolean).map((file) => file.name).join(', ');
    },
    clearFiles(name) {
      this.$set(this.selectedFiles, name, null);
      this.$set(this.inputResetKeys, name, (this.inputResetKeys[name] || 0) + 1);
    },
    async loadSkill() {
      this.loading = true;
      this.error = '';
      try {
        const catalog = await listSkills();
        this.skill = catalog.skills.find((item) => item.skillId === this.skillId) || null;
        if (!this.skill) throw new Error('The requested skill is not approved on this server.');
        const schema = this.skill.inputs.parametersSchema || {};
        const values = {};
        Object.entries(schema.properties || {}).forEach(([name, rule]) => {
          if (rule.default !== undefined) values[name] = rule.default;
          else if (rule.enum) values[name] = rule.enum[0];
          else if (rule.type === 'boolean') values[name] = false;
          else values[name] = '';
        });
        this.parameterValues = values;
        this.selectedFiles = {};
        this.inputResetKeys = {};
      } catch (error) {
        this.error = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    selectFiles(input, event) {
      const files = Array.from(event.target.files || []);
      this.$set(this.selectedFiles, input.name, input.multiple ? files : files[0] || null);
    },
    normalizedParameters() {
      const result = {};
      for (const entry of this.parameterEntries) {
        const value = this.parameterValues[entry.name];
        if (entry.rule.type === 'array') {
          const values = String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
          if (values.length || entry.required) result[entry.name] = values;
        } else if (entry.rule.type === 'integer') {
          if (value !== '' && value !== null) result[entry.name] = Number(value);
        } else if (value !== '' && value !== undefined) {
          result[entry.name] = value;
        }
      }
      return result;
    },
    async submit() {
      if (!this.canSubmit) return;
      this.submitting = true;
      this.creating = true;
      this.error = '';
      this.dismissErrorMessage();
      this.events = [];
      this.jobDetail = null;
      this.reAskAnswer = null;
      this.chatMessages = [];
      this.resetCancellationForm();
      try {
        const result = await createSkillJob(this.skillId, {
          files: this.selectedFiles,
          parameters: this.normalizedParameters(),
          browserTabSessionId: this.browserTabSessionId,
          idempotencyKey: randomId(`skill-${this.skillId}`)
        });
        this.upsertActiveSessionJob(result.job);
        this.rememberSelectedJobId(result.job.jobId);
        this.currentStatus = result.job.status;
        this.currentPhase = result.job.phase || '';
        this.consoleAutoStick = true;
        if (this.wsClient) this.wsClient.connect(result.job.jobId);
        await this.refreshJobDetail();
        await this.$nextTick();
        if (this.$refs.workerConsole) {
          this.$refs.workerConsole.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (error) {
        this.showWorkerNotification(getErrorMessage(error));
      } finally {
        this.submitting = false;
        this.creating = false;
      }
    }
  }
};
</script>
