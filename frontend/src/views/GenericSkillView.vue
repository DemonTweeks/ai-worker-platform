<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="displayError"
      :dismissible="Boolean(displayError)"
      @dismiss="dismissAllErrors"
    />

    <section class="workbench-hero" :aria-label="`${workbenchTitle} workbench`">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>{{ heroTitle }}</h2>
        <p class="workbench-subtitle">{{ heroSubtitle }}</p>

        <div class="workbench-chip-row" aria-label="Workflow status">
          <span v-for="chip in heroChips" :key="chip" class="workbench-chip">{{ chip }}</span>
          <span class="workbench-chip">{{ healthLabel }}</span>
        </div>

        <div class="workbench-action-row" aria-label="Primary actions">
          <a class="workbench-primary-link" href="#worker-workbench" @click.prevent="scrollToWorkbench">{{ primaryActionLabel }}</a>
          <a class="workbench-secondary-link" href="#worker-console">View Live Output</a>
        </div>
      </div>

      <section id="worker-workbench" ref="workbench" class="workbench-surface" :aria-label="`${workbenchTitle} workflow`">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Operational Workflow</p>
            <h3>{{ workbenchTitle }}</h3>
          </div>
          <span class="workbench-status-pill">{{ statusLabel }}</span>
        </div>

        <div v-if="loading" class="status-banner">Loading the approved skill contract...</div>

        <form v-else-if="skill" class="workbench-form" @submit.prevent="submit">
          <div class="workbench-main-grid">
            <div class="workbench-upload-stack">
              <template v-for="item in uploadColumnItems">
                <UploadPanel
                  v-if="item.type === 'file'"
                  :key="`file-${item.input.name}-${inputResetKeys[item.input.name] || 0}`"
                  class="cockpit-card upload-card workbench-upload-card"
                  :title="item.ui.title"
                  :input-id="inputId(item.input.name)"
                  :input-label="item.ui.label"
                  :input-hint="item.ui.hint"
                  :validate-label="item.ui.actionLabel"
                  :accept="item.input.acceptedExtensions.join(',')"
                  :multiple="item.input.multiple"
                  :result="fileValidationResults[item.input.name] || null"
                  :disable-action="submitting"
                  @file-selected="selectFiles(item.input, $event)"
                  @prevalidate="validateSelectedFiles(item.input, $event)"
                />
                <section
                  v-else
                  :key="`group-${item.group.id}`"
                  class="cockpit-card upload-card workbench-upload-card audit-period-card"
                >
                  <div class="cockpit-card-heading">
                    <span>{{ item.group.title }}</span>
                    <small>{{ item.group.subtitle }}</small>
                  </div>
                  <div class="audit-period-grid">
                    <ManifestParameterField
                      v-for="entry in item.entries"
                      :key="entry.name"
                      :entry="entry"
                      :value="parameterValues[entry.name]"
                      :disabled="submitting || isEntryDisabled(entry)"
                      @input="$set(parameterValues, entry.name, $event)"
                    />
                  </div>
                  <p v-if="item.group.hint" class="field-hint">{{ item.group.hint }}</p>
                </section>
              </template>
            </div>

            <section class="panel cockpit-card workbench-config-card">
              <div class="cockpit-card-heading">
                <span>Launch Configuration</span>
                <small>{{ configurationModeLabel }}</small>
              </div>

              <div v-if="configurationSwitcher || configGridEntries.length || configurationStages.length" class="workbench-config-grid">
                <div v-if="configurationSwitcher" class="cockpit-field-group">
                  <span class="field-label">{{ configurationSwitcher.label }}</span>
                  <div class="segmented compact-segmented">
                    <button
                      v-for="option in configurationSwitcher.options"
                      :key="option.skillId"
                      type="button"
                      :class="{ active: option.skillId === skillId }"
                      :disabled="submitting"
                      @click="switchSkill(option)"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </div>

                <ManifestParameterField
                  v-for="entry in configGridEntries"
                  :key="entry.name"
                  :entry="entry"
                  :value="parameterValues[entry.name]"
                  :disabled="submitting || isEntryDisabled(entry)"
                  @input="$set(parameterValues, entry.name, $event)"
                />

                <div v-if="configurationStages.length" class="cockpit-empty-card">
                  <strong>{{ configurationStageHeading }}</strong>
                  <ol class="audit-flow-list">
                    <li v-for="(stage, index) in configurationStages" :key="stage.title">
                      <span>{{ String(index + 1).padStart(2, '0') }}</span>
                      <div>
                        <strong>{{ stage.title }}</strong>
                        <p>{{ stage.description }}</p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>

              <div v-else class="cockpit-empty-card">
                This package does not require launch parameters.
              </div>

              <ManifestParameterField
                v-for="entry in configDetailEntries"
                :key="entry.name"
                class="workbench-sites-field"
                :entry="entry"
                :value="parameterValues[entry.name]"
                :disabled="submitting || isEntryDisabled(entry)"
                @input="$set(parameterValues, entry.name, $event)"
              />

              <div v-for="item in visibleConfigurationEmptyStates" :key="item.text" class="cockpit-empty-card">
                {{ item.text }}
              </div>

              <div v-if="configurationNotice" class="cockpit-empty-card">
                {{ configurationNotice }}
              </div>

              <div class="workbench-create-row">
                <button type="submit" class="action-button" :disabled="submitting || !canSubmit">
                  {{ submitting ? 'Creating...' : primaryActionLabel }}
                </button>
                <p v-if="!canSubmit" class="cockpit-note">{{ createDisabledReason }}</p>
                <p v-else class="cockpit-ready">{{ readyActionText }}</p>
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
import ManifestParameterField from '../components/ManifestParameterField.vue';
import UploadPanel from '../components/UploadPanel.vue';
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
    subtitle: 'Submit Final PO and EPMS once. The worker creates ECC entitlement, audits PO claims, and preserves evidence in one controlled run.'
  },
  'bom-builder': {
    title: 'Analyze TX BOM requirements with controlled evidence.',
    subtitle: 'Submit TX Mini EPMS and optional stock workbooks. The standalone skill owns classification, material proposals, inventory checks, and validation outputs.'
  }
};

const UPLOAD_TITLES = {
  site_data: 'Source Data Upload',
  bom: 'BOM Upload',
  epms: 'EPMS Upload',
  final_po: 'Final PO Upload',
  expected_ecc: 'Expected ECC Upload',
  scm_inventory: 'SCM Inventory Upload',
  huawei_stock: 'Huawei MW Stock Upload'
};

export default {
  name: 'GenericSkillView',
  mixins: [workerRuntimeMixin],
  components: { ErrorBanner, ManifestParameterField, UploadPanel },
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
      fileValidationResults: {},
      parameterValues: {},
      showLegacyControls: false,
      showOptionalHandoff: false
    };
  },
  computed: {
    skillDisplayName() {
      return this.skill ? this.skill.displayName : 'Loading skill...';
    },
    manifestUi() {
      return (this.skill && this.skill.ui) || {};
    },
    heroTitle() {
      return this.manifestUi.hero?.title || HERO_CONTENT[this.skillId]?.title || `Launch ${this.skillDisplayName} jobs.`;
    },
    heroSubtitle() {
      return this.manifestUi.hero?.subtitle || HERO_CONTENT[this.skillId]?.subtitle || 'Submit approved inputs through the shared Job workflow.';
    },
    heroChips() {
      const chips = this.manifestUi.hero?.chips || [this.skillDisplayName, 'Approved package', 'Standalone Python'];
      return this.manifestUi.hero?.includeModeChip ? [...chips, this.configurationModeLabel] : chips;
    },
    workbenchTitle() {
      return this.manifestUi.workbench?.title || this.skillDisplayName;
    },
    primaryActionLabel() {
      return this.manifestUi.actions?.primaryLabel || 'Create Job';
    },
    readyActionText() {
      return this.manifestUi.actions?.readyLabel || 'Ready to create Job';
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
      return this.manifestUi.workerLabel || this.skillDisplayName;
    },
    activeModeLabel() {
      return this.configurationModeLabel;
    },
    configuration() {
      return this.manifestUi.configuration || {};
    },
    configurationModeLabel() {
      if (this.configuration.mode?.field) {
        const value = this.parameterValues[this.configuration.mode.field];
        const label = this.configuration.mode.labels?.[String(value)];
        if (label) return label;
      }
      return this.configuration.modeLabel || this.parameterValues.scope || this.parameterValues.runMode || 'Manifest contract';
    },
    configurationSwitcher() {
      return this.configuration.switcher || null;
    },
    configurationNotice() {
      return this.configuration.notice || '';
    },
    visibleConfigurationEmptyStates() {
      return (this.configuration.emptyStates || []).filter((item) => this.matchesCondition(item.visibleWhen));
    },
    configurationStages() {
      return this.configuration.stages || [];
    },
    configurationStageHeading() {
      return this.configuration.stageHeading || 'Controlled run';
    },
    allParameterEntries() {
      if (!this.skill) return [];
      const schema = this.skill.inputs.parametersSchema || {};
      const required = new Set(schema.required || []);
      const presentations = this.manifestUi.parameters || {};
      return Object.entries(schema.properties || {}).map(([name, rule]) => ({
        name,
        rule,
        ui: presentations[name] || {},
        required: required.has(name)
      }));
    },
    parameterEntries() {
      return this.allParameterEntries.filter((entry) => !entry.ui.hidden && this.isEntryVisible(entry));
    },
    uploadGroups() {
      const entryMap = new Map(this.parameterEntries.map((entry) => [entry.name, entry]));
      return (this.manifestUi.uploadGroups || []).map((group) => ({
        ...group,
        entries: (group.fields || []).map((name) => entryMap.get(name)).filter(Boolean)
      })).filter((group) => group.entries.length);
    },
    uploadColumnItems() {
      if (!this.skill) return [];
      const pendingGroups = [...this.uploadGroups];
      const items = [];
      this.skill.inputs.files.forEach((input) => {
        items.push({ type: 'file', input, ui: this.uploadPresentation(input) });
        pendingGroups.filter((group) => group.after === input.name).forEach((group) => {
          items.push({ type: 'group', group, entries: group.entries });
        });
      });
      pendingGroups.filter((group) => !group.after).forEach((group) => {
        items.push({ type: 'group', group, entries: group.entries });
      });
      return items;
    },
    groupedParameterNames() {
      return new Set(this.uploadGroups.flatMap((group) => group.fields || []));
    },
    configGridEntries() {
      const order = this.configuration.fieldOrder || [];
      return this.parameterEntries
        .filter((entry) => !this.groupedParameterNames.has(entry.name) && entry.ui.placement !== 'detail')
        .sort((left, right) => {
          const leftIndex = order.indexOf(left.name);
          const rightIndex = order.indexOf(right.name);
          return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
        });
    },
    configDetailEntries() {
      return this.parameterEntries.filter((entry) => entry.ui.placement === 'detail');
    },
    canSubmit() {
      if (!this.skill) return false;
      const filesReady = this.skill.inputs.files.every((input) => {
        if (input.required && !this.hasSelectedFile(input.name)) return false;
        if (!this.hasSelectedFile(input.name)) return true;
        const ui = this.uploadPresentation(input);
        return !ui.validationRequired || Boolean(this.fileValidationResults[input.name]?.passed);
      });
      const parametersReady = this.parameterEntries.every((entry) => {
        const conditionallyRequired = entry.ui.requiredWhenVisible || (
          entry.ui.requiredWhen && this.matchesCondition(entry.ui.requiredWhen)
        );
        if (!entry.required && !conditionallyRequired) return true;
        const value = this.parameterValues[entry.name];
        if (entry.rule.type === 'array') {
          return String(value || '').split(/[\r\n,]+/).some((item) => item.trim());
        }
        return value !== '' && value !== null && value !== undefined;
      });
      return filesReady && parametersReady;
    },
    createDisabledReason() {
      if (!this.skill) return 'Loading the approved skill contract.';
      const missing = this.skill.inputs.files.filter((input) => input.required && !this.hasSelectedFile(input.name));
      if (missing.length) return this.manifestUi.actions?.missingFilesMessage || 'Select every required input before creating the Job.';
      const pendingValidation = this.skill.inputs.files.some((input) => (
        this.hasSelectedFile(input.name)
        && this.uploadPresentation(input).validationRequired
        && !this.fileValidationResults[input.name]?.passed
      ));
      if (pendingValidation) return this.manifestUi.actions?.validationMessage || 'Validate every selected input before creating the Job.';
      return this.manifestUi.actions?.missingParametersMessage || 'Complete every required launch parameter.';
    },
    primaryDownloadFile() {
      if (!this.jobDetail || !Array.isArray(this.jobDetail.outputs)) return null;
      if (this.skillId === 'tx-pr-auditor') {
        return this.jobDetail.outputs.find((file) => file.available && /\.xlsx$/i.test(file.fileName || '')) || null;
      }
      return this.jobDetail.outputs.find((file) => file.available && /\.zip$/i.test(file.fileName || ''))
        || this.jobDetail.outputs.find((file) => file.available)
        || null;
    },
    canDownload() {
      return Boolean(this.primaryDownloadFile);
    },
    downloadUrl() {
      if (!this.currentJobId || !this.primaryDownloadFile) return '#';
      return /\.zip$/i.test(this.primaryDownloadFile.fileName || '')
        ? getZipDownloadUrl(this.currentJobId)
        : getFileDownloadUrl(this.currentJobId, this.primaryDownloadFile.id);
    },
    downloadButtonLabel() {
      if (this.skillId === 'tx-pr-auditor') return 'Download Audit Report';
      return this.primaryDownloadFile && /\.zip$/i.test(this.primaryDownloadFile.fileName || '')
        ? 'Download ZIP'
        : 'Download Output';
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
    uploadPresentation(input) {
      const configured = this.manifestUi.uploads?.[input.name] || {};
      return {
        title: configured.title || UPLOAD_TITLES[input.name] || `${this.labelFor(input.name)} Upload`,
        label: configured.label || this.labelFor(input.name),
        hint: configured.hint || `${input.multiple ? 'Select one or more source files.' : 'Select the source file.'} Accepted: ${input.acceptedExtensions.join(', ')}`,
        actionLabel: configured.actionLabel || 'Validate File',
        validationRequired: Boolean(configured.validationRequired)
      };
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
      this.$delete(this.fileValidationResults, name);
      this.$set(this.inputResetKeys, name, (this.inputResetKeys[name] || 0) + 1);
    },
    isEntryVisible(entry) {
      return this.matchesCondition(entry.ui.visibleWhen);
    },
    isEntryDisabled(entry) {
      return Boolean(entry.ui.disabledWhen) && this.matchesCondition(entry.ui.disabledWhen);
    },
    matchesCondition(condition) {
      if (!condition) return true;
      const actual = this.parameterValues[condition.field];
      if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return actual === condition.equals;
      if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(actual);
      return true;
    },
    initialParameterValue(rule, presentation) {
      if (Object.prototype.hasOwnProperty.call(presentation, 'default')) return presentation.default;
      if (presentation.defaultFrom === 'currentYear') return new Date().getFullYear();
      if (presentation.defaultFrom === 'currentMonth') return new Date().getMonth() + 1;
      if (rule.default !== undefined) return rule.default;
      if (rule.enum) return rule.enum[0];
      if (rule.type === 'boolean') return false;
      return '';
    },
    async loadSkill() {
      this.loading = true;
      this.error = '';
      try {
        const catalog = await listSkills();
        this.skill = catalog.skills.find((item) => item.skillId === this.skillId) || null;
        if (!this.skill) throw new Error('The requested skill is not approved on this server.');
        const schema = this.skill.inputs.parametersSchema || {};
        const presentations = this.manifestUi.parameters || {};
        const values = {};
        Object.entries(schema.properties || {}).forEach(([name, rule]) => {
          values[name] = this.initialParameterValue(rule, presentations[name] || {});
        });
        this.parameterValues = values;
        this.selectedFiles = {};
        this.inputResetKeys = {};
        this.fileValidationResults = {};
      } catch (error) {
        this.error = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    selectFiles(input, selected) {
      this.$set(this.selectedFiles, input.name, selected);
      this.$delete(this.fileValidationResults, input.name);
    },
    validateSelectedFiles(input, selected) {
      const files = (Array.isArray(selected) ? selected : [selected]).filter(Boolean);
      const accepted = (input.acceptedExtensions || []).map((extension) => extension.toLowerCase());
      const extensionCheck = files.length > 0 && files.every((file) => accepted.includes(`.${file.name.split('.').pop().toLowerCase()}`));
      const countCheck = !input.maximumCount || files.length <= input.maximumCount;
      const sizeCheck = !input.maximumBytes || files.every((file) => file.size <= input.maximumBytes);
      const checklist = [
        { name: 'Accepted file type', passed: extensionCheck },
        { name: 'File count', passed: countCheck },
        { name: 'File size', passed: sizeCheck }
      ];
      const passed = checklist.every((item) => item.passed);
      this.$set(this.fileValidationResults, input.name, {
        passed,
        checklist,
        workerExplanation: passed
          ? 'File contract checks passed. Business validation runs inside the approved skill.'
          : 'The selected input does not meet the manifest file contract.'
      });
    },
    switchSkill(option) {
      if (!option || option.skillId === this.skillId || !option.routeName) return;
      this.$router.push({ name: option.routeName });
    },
    normalizedParameters() {
      const result = {};
      for (const entry of this.allParameterEntries) {
        if (entry.ui.omitWhenHidden && !this.isEntryVisible(entry)) continue;
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
