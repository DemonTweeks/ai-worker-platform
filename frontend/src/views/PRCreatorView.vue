<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="errorMessage"
      :dismissible="Boolean(errorMessage)"
      @dismiss="dismissErrorMessage"
    />

    <section class="workbench-hero" aria-label="PR Creator workbench">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>{{ heroTitle }}</h2>
        <p class="workbench-subtitle">
          {{ heroSubtitle }}
        </p>

        <div class="workbench-chip-row" aria-label="Workflow status">
          <span class="workbench-chip">{{ activeWorkerLabel }}</span>
          <span class="workbench-chip">Validate</span>
          <span class="workbench-chip">{{ activeModeLabel }}</span>
          <span class="workbench-chip">{{ healthLabel }}</span>
        </div>

        <div class="workbench-action-row" aria-label="Primary actions">
          <a class="workbench-primary-link" href="#worker-workbench">{{ primaryActionLabel }}</a>
          <a class="workbench-secondary-link" href="#worker-console">View Live Output</a>
        </div>
      </div>

      <section id="worker-workbench" class="workbench-surface" :aria-label="activeWorkbenchAriaLabel">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Operational Workflow</p>
            <h3>{{ activeWorkbenchTitle }}</h3>
          </div>
          <span class="workbench-status-pill">{{ progressStateLabel }}</span>
        </div>

        <div class="workbench-main-grid">
          <div v-if="isMwWorker" class="workbench-upload-stack">
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              :result="prevalidation"
              :loading="prevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onFileSelected"
              @prevalidate="prevalidate"
            />
          </div>
          <div v-else class="workbench-upload-stack">
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="BOM Upload"
              input-id="ran-bom-file"
              input-label="BOM workbook"
              input-hint="Upload the source BOM workbook required for the RAN PR worker."
              validate-label="Validate BOM"
              accept=".xlsx,.xls"
              :result="ranBomPrevalidation"
              :loading="ranBomPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onRanFileSelected('bom', $event)"
              @prevalidate="prevalidateRanUpload('bom', $event)"
            />
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="EPMS Upload"
              input-id="ran-epms-file"
              input-label="EPMS workbook"
              input-hint="Upload the EPMS workbook required for RAN matching and General Item logic."
              validate-label="Validate EPMS"
              accept=".xlsx,.xls"
              :result="ranEpmsPrevalidation"
              :loading="ranEpmsPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onRanFileSelected('epms', $event)"
              @prevalidate="prevalidateRanUpload('epms', $event)"
            />
          </div>

          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Launch Configuration</span>
              <small>{{ activeModeLabel }}</small>
            </div>

            <div class="workbench-config-grid">
              <div class="cockpit-field-group">
                <span class="field-label">PR Creator Mode</span>
                <div class="segmented compact-segmented">
                  <button
                    type="button"
                    :class="{ active: selectedWorkerId === 'mw-pr' }"
                    @click="handleWorkerChange('mw-pr')"
                  >
                    MW PR
                  </button>
                  <button
                    type="button"
                    :class="{ active: selectedWorkerId === 'ran-pr' }"
                    @click="handleWorkerChange('ran-pr')"
                  >
                    RAN PR
                  </button>
                </div>
              </div>

              <template v-if="isMwWorker">
                <div class="cockpit-field-group">
                  <span class="field-label">Site mode</span>
                  <div class="segmented compact-segmented">
                    <button
                      type="button"
                      :class="{ active: generationScope === 'site_code' }"
                      @click="generationScope = 'site_code'"
                    >
                      Single site
                    </button>
                    <button
                      type="button"
                      :class="{ active: generationScope === 'all_sites' }"
                      @click="generationScope = 'all_sites'"
                    >
                      All sites
                    </button>
                  </div>
                </div>

                <div class="cockpit-field-group">
                  <span class="field-label">Task Type</span>
                  <div class="segmented compact-segmented">
                    <button
                      v-for="option in prScopeOptions"
                      :key="option"
                      type="button"
                      :class="{ active: prScope === option }"
                      @click="prScope = option"
                    >
                      {{ option }}
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="cockpit-field-group">
                  <span class="field-label">Run mode</span>
                  <div class="segmented compact-segmented">
                    <button
                      type="button"
                      :class="{ active: ranRunMode === 'standard-pr' }"
                      @click="ranRunMode = 'standard-pr'"
                    >
                      Standard PR
                    </button>
                    <button
                      type="button"
                      :class="{ active: ranRunMode === 'general-item' }"
                      @click="ranRunMode = 'general-item'"
                    >
                      General Item
                    </button>
                  </div>
                </div>

                <div class="cockpit-field-group">
                  <span class="field-label">General Item project</span>
                  <select
                    class="cockpit-sites-input compact-inline-select"
                    :disabled="ranRunMode !== 'general-item' || ranProjectLoading"
                    :value="ranSelectedProject"
                    @change="ranSelectedProject = $event.target.value"
                  >
                    <option value="">{{ ranProjectLoading ? 'Loading projects...' : 'Select a validated project' }}</option>
                    <option
                      v-for="project in ranProjects"
                      :key="project"
                      :value="project"
                    >
                      {{ project }}
                    </option>
                  </select>
                  <p v-if="ranProjectLoadError" class="cockpit-note">{{ ranProjectLoadError }}</p>
                </div>
              </template>
            </div>

            <div v-if="isMwWorker" class="cockpit-field-group workbench-sites-field">
              <div class="cockpit-card-heading">
                <span>Sites</span>
                <small>{{ siteCodeCount }} site(s)</small>
              </div>
              <textarea
                v-if="generationScope === 'site_code'"
                class="cockpit-sites-input"
                :value="siteCodesText"
                rows="5"
                placeholder="Paste site codes, comma or line separated"
                @input="siteCodesText = $event.target.value"
              />
              <div v-else class="cockpit-empty-card">
                All sites mode is selected.
              </div>
            </div>
            <div v-else class="cockpit-empty-card">
              {{ ranRunMode === 'general-item' ? 'Select a workbook-backed General Item project after both uploads validate.' : 'Standard PR runs non-interactively after BOM and EPMS validation.' }}
            </div>

            <div class="workbench-create-row">
              <LoadingButton
                :label="primaryActionLabel"
                loading-text="Creating..."
                :loading="creating"
                :disabled="!canCreateJob"
                @click="createWorkerJob"
              />
              <button
                v-if="activePendingIdempotencyKey && !creating"
                type="button"
                class="secondary-link"
                @click="beginCreateAnotherJob"
              >
                {{ secondaryActionLabel }}
              </button>
              <p v-if="createDisabledReason" class="cockpit-note">{{ createDisabledReason }}</p>
              <p v-else-if="activePendingIdempotencyKey" class="cockpit-note">{{ idempotencyNotice }}</p>
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
                  <td>{{ job.createdAt || 'Now' }}</td>
                  <td>
                    <button type="button" class="secondary-link" @click="viewLiveOutput(job.jobId)">
                      View
                    </button>
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
                />
                <div class="workbench-action-row">
                  <button type="button" class="workbench-secondary-link" :disabled="cancellingRequest" @click="submitCancellationRequest">
                    {{ cancellingRequest ? 'Stopping...' : 'Confirm Stop Job' }}
                  </button>
                  <button type="button" class="secondary-link" :disabled="cancellingRequest" @click="resetCancellationForm">
                    Keep Running
                  </button>
                </div>
              </div>
              <p class="cockpit-note">This worker form is locked while the active job is queued, running, or cancelling.</p>
            </div>
            <a
              v-if="canDownload"
              class="download-button"
              :href="downloadUrl"
            >
              {{ downloadButtonLabel }}
            </a>
            <p v-if="deliveryWarningMessage" class="cockpit-note">{{ deliveryWarningMessage }}</p>
            <p v-else class="cockpit-note">{{ downloadUnavailableMessage }}</p>
            <p v-if="jobReady && !canDownload && !isCancelledResult" class="cockpit-note">Output delivery is complete for this Job.</p>
          </div>
        </section>
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
        />
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
          <span>{{ updatedAt || 'No live update yet' }}</span>
        </div>
      </div>

      <div
        ref="consoleBody"
        class="cockpit-console"
        @scroll="onConsoleScroll"
      >
        <article
          v-for="(item, index) in consoleItems"
          :key="item.id"
          class="console-entry"
          :class="[{ 'is-faded': index < consoleItems.length - 4 }, `entry-${item.tone}`]"
        >
          <div class="console-entry-meta">
            <span>{{ item.label }}</span>
            <time>{{ item.time || 'Current session' }}</time>
          </div>
          <div class="console-message-bubble">
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
            <small v-if="item.meta" class="console-message-meta">{{ item.meta }}</small>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script>
import UploadPanel from '../components/UploadPanel.vue';
import ErrorBanner from '../components/ErrorBanner.vue';
import LoadingButton from '../components/LoadingButton.vue';
import { createJob, getErrorMessage, listRanProjects, prevalidateUpload } from '../api/jobApi';
import {
  buildWorkerIdempotencyStorageKey,
  createIdempotencyKey,
  workerRuntimeMixin
} from './shared/workerRuntime';

export default {
  name: 'PRCreatorView',
  components: {
    ErrorBanner,
    UploadPanel,
    LoadingButton
  },
  mixins: [workerRuntimeMixin],
  data() {
    return {
      selectedWorkerId: 'mw-pr',
      selectedFile: null,
      prevalidation: null,
      prevalidating: false,
      prScope: 'TSS',
      prScopeOptions: ['TSS', 'TI'],
      generationScope: 'site_code',
      siteCodesText: '',
      ranRunMode: 'standard-pr',
      ranSelectedProject: '',
      ranProjects: [],
      ranProjectLoading: false,
      ranProjectLoadError: '',
      ranBomFile: null,
      ranEpmsFile: null,
      ranBomPrevalidation: null,
      ranEpmsPrevalidation: null,
      ranBomPrevalidating: false,
      ranEpmsPrevalidating: false,
      mwPendingIdempotencyKey: '',
      ranPendingIdempotencyKey: ''
    };
  },
  computed: {
    isMwWorker() {
      return this.selectedWorkerId === 'mw-pr';
    },
    isRanWorker() {
      return this.selectedWorkerId === 'ran-pr';
    },
    heroTitle() {
      return 'Launch PR Creator jobs with MW PR and RAN PR modes.';
    },
    heroSubtitle() {
      return 'Launch MW PR or RAN PR jobs with validated inputs, live progress, and controlled result delivery from one dedicated PR Creator route.';
    },
    activeWorkerLabel() {
      return this.isRanWorker ? 'RAN PR Worker' : 'MW PR Worker';
    },
    activeModeLabel() {
      if (this.isRanWorker) {
        return this.ranRunMode === 'general-item' ? 'General Item' : 'Standard PR';
      }

      return this.generationScopeLabel;
    },
    activeWorkbenchTitle() {
      return 'PR Creator';
    },
    activeWorkbenchAriaLabel() {
      return 'PR Creator workflow';
    },
    primaryActionLabel() {
      return 'Create Job';
    },
    secondaryActionLabel() {
      return 'Create Another Job';
    },
    readyActionText() {
      return 'Ready to create Job';
    },
    idempotencyNotice() {
      return 'This Create Job action will reuse the current idempotency key until you change inputs or choose Create Another Job.';
    },
    activePendingIdempotencyKey() {
      return this.isRanWorker ? this.ranPendingIdempotencyKey : this.mwPendingIdempotencyKey;
    },
    canCreateJob() {
      if (this.creating) return false;

      if (this.isRanWorker) {
        if (!this.ranBomFile || !this.ranEpmsFile) return false;
        if (!this.ranBomPrevalidation || !this.ranBomPrevalidation.passed) return false;
        if (!this.ranEpmsPrevalidation || !this.ranEpmsPrevalidation.passed) return false;
        if (this.ranRunMode === 'general-item' && !this.ranSelectedProject) return false;
        return true;
      }

      if (!this.prevalidation || !this.prevalidation.passed) return false;
      if (this.generationScope === 'site_code' && this.parseSiteCodes().length === 0) return false;
      if (!this.selectedFile) return false;
      return true;
    },
    createDisabledReason() {
      if (this.isRanWorker) {
        if (!this.ranBomFile || !this.ranEpmsFile) return 'Upload both BOM and EPMS workbooks to start.';
        if (this.ranBomPrevalidating || this.ranEpmsPrevalidating) return 'RAN upload validation is in progress.';
        if (!this.ranBomPrevalidation || !this.ranEpmsPrevalidation) return 'Validate both BOM and EPMS workbooks before creating a Job.';
        if (!this.ranBomPrevalidation.passed || !this.ranEpmsPrevalidation.passed) return 'Validation failed; resolve the RAN upload issues before creating a Job.';
        if (this.ranRunMode === 'general-item' && !this.ranSelectedProject) return 'Select a validated General Item project before creating a Job.';
        if (this.creating) return 'Submitting job request.';
        return '';
      }

      if (!this.selectedFile) return 'Upload a source file to start.';
      if (this.prevalidating) return 'Prevalidation is in progress.';
      if (!this.prevalidation) return 'Run validation before creating a Job.';
      if (!this.prevalidation.passed) return 'Validation failed; resolve the listed issues before creating a Job.';
      if (this.generationScope === 'site_code' && this.parseSiteCodes().length === 0) return 'Add at least one site code for single-site mode.';
      if (this.creating) return 'Submitting job request.';
      return '';
    },
    generationScopeLabel() {
      return this.generationScope === 'all_sites' ? 'All Sites' : 'Single Site';
    },
    siteCodeCount() {
      return this.parseSiteCodes().length;
    },
    consoleItems() {
      const items = [
        {
          id: 'session-ready',
          label: 'Workbench',
          title: 'Ready for PR Creator upload',
          body: 'Choose MW PR or RAN PR mode, validate the required files, create a Job, then track progress and outputs here.',
          tone: 'info',
          time: ''
        }
      ];

      if (this.isMwWorker && this.selectedFile) {
        items.push({
          id: 'mw-file-selected',
          label: 'Upload',
          title: 'MW source file selected',
          body: this.selectedFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.isMwWorker && this.prevalidation) {
        items.push({
          id: 'mw-validation-state',
          label: 'Validate',
          title: this.prevalidation.passed ? 'Validation passed' : 'Validation failed',
          body: this.prevalidation.workerExplanation || (this.prevalidation.passed ? 'The file is ready for Job creation.' : 'Review the validation checklist and correct the source file.'),
          tone: this.prevalidation.passed ? 'success' : 'danger',
          time: ''
        });
      }

      if (this.isRanWorker && this.ranBomFile) {
        items.push({
          id: 'ran-bom-file-selected',
          label: 'Upload',
          title: 'RAN BOM workbook selected',
          body: this.ranBomFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.isRanWorker && this.ranEpmsFile) {
        items.push({
          id: 'ran-epms-file-selected',
          label: 'Upload',
          title: 'RAN EPMS workbook selected',
          body: this.ranEpmsFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.isRanWorker && this.ranBomPrevalidation) {
        items.push({
          id: 'ran-bom-validation-state',
          label: 'Validate',
          title: this.ranBomPrevalidation.passed ? 'BOM validation passed' : 'BOM validation failed',
          body: this.ranBomPrevalidation.workerExplanation || (this.ranBomPrevalidation.passed ? 'The BOM workbook is ready for Job creation.' : 'Review the BOM validation checklist and correct the workbook.'),
          tone: this.ranBomPrevalidation.passed ? 'success' : 'danger',
          time: ''
        });
      }

      if (this.isRanWorker && this.ranEpmsPrevalidation) {
        items.push({
          id: 'ran-epms-validation-state',
          label: 'Validate',
          title: this.ranEpmsPrevalidation.passed ? 'EPMS validation passed' : 'EPMS validation failed',
          body: this.ranEpmsPrevalidation.workerExplanation || (this.ranEpmsPrevalidation.passed ? 'The EPMS workbook is ready for Job creation.' : 'Review the EPMS validation checklist and correct the workbook.'),
          tone: this.ranEpmsPrevalidation.passed ? 'success' : 'danger',
          time: ''
        });
      }

      return [...items, ...this.buildSharedConsoleItems()];
    }
  },
  watch: {
    consoleItems() {
      this.$nextTick(() => {
        this.scrollConsoleToBottom(false);
      });
    },
    generationScope() {
      this.resetPendingIdempotencyKey('mw-pr');
    },
    prScope() {
      this.resetPendingIdempotencyKey('mw-pr');
    },
    siteCodesText() {
      this.resetPendingIdempotencyKey('mw-pr');
    },
    ranRunMode() {
      this.resetPendingIdempotencyKey('ran-pr');
    },
    ranSelectedProject() {
      this.resetPendingIdempotencyKey('ran-pr');
    }
  },
  methods: {
    initializePendingIdempotencyKeys() {
      this.mwPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('mw-pr')) || '';
      this.ranPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('ran-pr')) || '';
    },
    setPendingIdempotencyKey(workerId, idempotencyKey) {
      const storageKey = buildWorkerIdempotencyStorageKey(workerId);
      sessionStorage.setItem(storageKey, idempotencyKey);

      if (workerId === 'ran-pr') {
        this.ranPendingIdempotencyKey = idempotencyKey;
        return;
      }

      this.mwPendingIdempotencyKey = idempotencyKey;
    },
    ensurePendingIdempotencyKey(workerId) {
      const currentValue = workerId === 'ran-pr'
        ? this.ranPendingIdempotencyKey
        : this.mwPendingIdempotencyKey;

      if (currentValue) {
        return currentValue;
      }

      const created = createIdempotencyKey(workerId);
      this.setPendingIdempotencyKey(workerId, created);
      return created;
    },
    resetPendingIdempotencyKey(workerId) {
      const storageKey = buildWorkerIdempotencyStorageKey(workerId);
      sessionStorage.removeItem(storageKey);

      if (workerId === 'ran-pr') {
        this.ranPendingIdempotencyKey = '';
        return;
      }

      this.mwPendingIdempotencyKey = '';
    },
    resetActivePendingIdempotencyKey() {
      this.resetPendingIdempotencyKey(this.selectedWorkerId);
    },
    async handleWorkerChange(workerId) {
      if (this.selectedWorkerId === workerId) {
        if (workerId === 'ran-pr' && this.ranProjects.length === 0) {
          await this.loadRanProjects();
        }
        return;
      }

      this.selectedWorkerId = workerId;
      this.dismissErrorMessage();

      if (workerId === 'mw-pr') {
        this.selectedFile = null;
        this.prevalidation = null;
        return;
      }

      this.ranSelectedProject = '';
      if (this.ranProjects.length === 0) {
        await this.loadRanProjects();
      }
    },
    async loadRanProjects() {
      this.ranProjectLoading = true;
      this.ranProjectLoadError = '';
      try {
        const result = await listRanProjects();
        this.ranProjects = Array.isArray(result.projects) ? result.projects : [];
      } catch (error) {
        this.ranProjects = [];
        this.ranProjectLoadError = getErrorMessage(error);
      } finally {
        this.ranProjectLoading = false;
      }
    },
    onFileSelected(file) {
      this.selectedFile = file;
      this.prevalidation = null;
      this.resetPendingIdempotencyKey('mw-pr');
    },
    onRanFileSelected(kind, file) {
      if (kind === 'bom') {
        this.ranBomFile = file;
        this.ranBomPrevalidation = null;
      } else {
        this.ranEpmsFile = file;
        this.ranEpmsPrevalidation = null;
      }
      this.resetPendingIdempotencyKey('ran-pr');
    },
    async prevalidate(file) {
      if (!file) {
        this.errorMessage = 'Select an input file first.';
        return;
      }
      this.prevalidating = true;
      this.errorMessage = '';
      try {
        this.prevalidation = await prevalidateUpload(file, null, {
          workerId: 'mw-pr',
          browserTabSessionId: this.browserTabSessionId
        });
      } catch (error) {
        this.prevalidation = this.getSafePrevalidationPayload(error);
        if (!this.isExpectedPrevalidationFailure(error)) {
          this.errorMessage = getErrorMessage(error);
        }
      } finally {
        this.prevalidating = false;
      }
    },
    async prevalidateRanUpload(kind, file) {
      if (!file) {
        this.errorMessage = `Select a ${kind === 'bom' ? 'BOM' : 'EPMS'} file first.`;
        return;
      }

      const isBom = kind === 'bom';
      if (isBom) {
        this.ranBomPrevalidating = true;
      } else {
        this.ranEpmsPrevalidating = true;
      }
      this.errorMessage = '';

      try {
        const result = await prevalidateUpload(file, isBom ? 'ran-bom' : 'ran-epms', {
          workerId: 'ran-pr',
          browserTabSessionId: this.browserTabSessionId
        });
        if (isBom) {
          this.ranBomPrevalidation = result;
        } else {
          this.ranEpmsPrevalidation = result;
        }
      } catch (error) {
        const fallback = this.getSafePrevalidationPayload(error);
        if (isBom) {
          this.ranBomPrevalidation = fallback;
        } else {
          this.ranEpmsPrevalidation = fallback;
        }
        if (!this.isExpectedPrevalidationFailure(error)) {
          this.errorMessage = getErrorMessage(error);
        }
      } finally {
        if (isBom) {
          this.ranBomPrevalidating = false;
        } else {
          this.ranEpmsPrevalidating = false;
        }
      }
    },
    parseSiteCodes() {
      return this.siteCodesText
        .split(/[\s,]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .filter((item, index, items) => items.indexOf(item) === index);
    },
    isSafePrevalidationPayload(payload) {
      return Boolean(
        payload &&
        typeof payload === 'object' &&
        typeof payload.passed === 'boolean' &&
        (!Object.prototype.hasOwnProperty.call(payload, 'checklist') || Array.isArray(payload.checklist))
      );
    },
    getSafePrevalidationPayload(error) {
      const payload = error && error.response ? error.response.data : null;
      return this.isSafePrevalidationPayload(payload) ? payload : null;
    },
    isExpectedPrevalidationFailure(error) {
      return Boolean(
        error &&
        error.response &&
        error.response.status === 400 &&
        this.isSafePrevalidationPayload(error.response.data)
      );
    },
    async createWorkerJob() {
      if (!this.canCreateJob) return;
      this.creating = true;
      this.dismissErrorMessage();
      this.events = [];
      this.jobDetail = null;
      this.reAskAnswer = null;
      this.chatMessages = [];
      this.resetCancellationForm();
      try {
        const workerId = this.isRanWorker ? 'ran-pr' : 'mw-pr';
        const idempotencyKey = this.ensurePendingIdempotencyKey(workerId);
        const payload = this.isRanWorker
          ? {
              workerId,
              browserTabSessionId: this.browserTabSessionId,
              idempotencyKey,
              bomPrevalidatedFileId: this.ranBomPrevalidation.prevalidatedFileId,
              epmsPrevalidatedFileId: this.ranEpmsPrevalidation.prevalidatedFileId,
              runMode: this.ranRunMode,
              selectedProject: this.ranRunMode === 'general-item' ? this.ranSelectedProject : undefined
            }
          : {
              workerId,
              browserTabSessionId: this.browserTabSessionId,
              idempotencyKey,
              prevalidatedFileId: this.prevalidation.prevalidatedFileId,
              prScope: this.prScope,
              generationScope: this.generationScope,
              siteCodes: this.generationScope === 'site_code' ? this.parseSiteCodes() : []
            };
        const result = await createJob(payload);
        this.upsertActiveSessionJob(result.job);
        this.rememberSelectedJobId(result.job.jobId);
        this.currentPrScope = result.job.prScope || (this.isRanWorker ? 'RAN' : this.prScope);
        this.currentStatus = result.job.status;
        this.currentPhase = result.job.phase || '';
        this.consoleAutoStick = true;
        this.wsClient.connect(this.currentJobId);
        await this.refreshJobDetail();
      } catch (error) {
        this.showWorkerNotification(this.getWorkerNotificationMessage(error));
      } finally {
        this.creating = false;
      }
    }
  }
};
</script>
