<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="errorMessage"
      :dismissible="Boolean(errorMessage)"
      @dismiss="dismissErrorMessage"
    />

    <section class="workbench-hero" aria-label="AI Worker workbench">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>Launch validated worker jobs from one operations cockpit.</h2>
        <p class="workbench-subtitle">
          Launch MW PR, RAN PR, or PR Auditor jobs with validated inputs, live progress, and controlled result delivery.
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
          <div v-else-if="isRanWorker" class="workbench-upload-stack">
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
          <div v-else class="workbench-upload-stack">
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="Final PO Upload"
              input-id="pr-auditor-final-po-file"
              input-label="Final PO workbook"
              input-hint="Upload the current Final PO workbook to be audited."
              validate-label="Validate Final PO"
              accept=".xlsx,.xls"
              :result="prAuditorFinalPoPrevalidation"
              :loading="prAuditorFinalPoPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onPrAuditorFileSelected('finalPo', $event)"
              @prevalidate="prevalidatePrAuditorUpload('finalPo', $event)"
            />
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="EPMS Upload"
              input-id="pr-auditor-epms-file"
              input-label="EPMS workbook"
              input-hint="Upload the EPMS workbook used for audit matching."
              validate-label="Validate EPMS"
              accept=".xlsx,.xls"
              :result="prAuditorEpmsPrevalidation"
              :loading="prAuditorEpmsPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onPrAuditorFileSelected('epms', $event)"
              @prevalidate="prevalidatePrAuditorUpload('epms', $event)"
            />
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="PR Model Upload"
              input-id="pr-auditor-pr-model-file"
              input-label="PR Model workbook"
              input-hint="Upload the PR Model workbook that defines the expected audit rules."
              validate-label="Validate PR Model"
              accept=".xlsx,.xls"
              :result="prAuditorPrModelPrevalidation"
              :loading="prAuditorPrModelPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onPrAuditorFileSelected('prModel', $event)"
              @prevalidate="prevalidatePrAuditorUpload('prModel', $event)"
            />
          </div>

          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Launch Configuration</span>
              <small>{{ activeModeLabel }}</small>
            </div>

            <div class="workbench-config-grid">
              <div class="cockpit-field-group">
                <span class="field-label">Worker</span>
                <div class="segmented compact-segmented">
                  <button
                    type="button"
                    :class="{ active: selectedWorkerId === 'mw-pr' }"
                    @click="handleWorkerChange('mw-pr')"
                  >
                    MW PR Worker
                  </button>
                  <button
                    type="button"
                    :class="{ active: selectedWorkerId === 'ran-pr' }"
                    @click="handleWorkerChange('ran-pr')"
                  >
                    RAN PR Worker
                  </button>
                  <button
                    type="button"
                    :class="{ active: selectedWorkerId === 'pr-auditor' }"
                    @click="handleWorkerChange('pr-auditor')"
                  >
                    PR Auditor
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

              <template v-else-if="isRanWorker">
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
              <template v-else>
                <div class="cockpit-empty-card">
                  <strong>PR Auditor</strong>
                  <p>PR Auditor reviews submitted PO data against configured audit rules.</p>
                  <p>It does not create or modify PR or ECC records.</p>
                  <p>Audit findings require business review.</p>
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
              {{ isPrAuditorWorker ? 'Run Audit uses the validated Final PO, EPMS, and PR Model workbooks for one dedicated PR Auditor job.' : (ranRunMode === 'general-item' ? 'Select a workbook-backed General Item project after both uploads validate.' : 'Standard PR runs non-interactively after BOM and EPMS validation.') }}
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
                    <button type="button" class="secondary-link" @click="selectActiveJob(job.jobId)">
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

        <section class="panel cockpit-card workbench-result-card">
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

    <section id="worker-console" class="cockpit-console-shell">
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
import JobWebSocketClient from '../services/websocketClient';
import { cancelJob, createJob, getErrorMessage, getFileDownloadUrl, getHealth, getJobDetail, getZipDownloadUrl, listJobs, listRanProjects, prevalidateUpload } from '../api/jobApi';
import { askJob } from '../api/reAskApi';
import { displayMessage, isTerminalStatus } from '../utils/statusUtils';
import {
  scheduleNotificationDismiss,
  isWorkerTimeoutError,
  WORKER_NOTIFICATION_TIMEOUT_MS,
  WORKER_TIMEOUT_NOTIFICATION_MESSAGE
} from '../utils/workerNotificationUtils';

const BROWSER_TAB_SESSION_STORAGE_KEY = 'browserTabSessionId';
const SELECTED_JOB_STORAGE_KEY = 'selectedJobId';
const WORKER_IDEMPOTENCY_STORAGE_PREFIX = 'workerCreateIdempotencyKey:';
const SELECTED_JOB_CHANGED_EVENT = 'awp:selected-job-changed';

const buildWorkerIdempotencyStorageKey = (workerId) => `${WORKER_IDEMPOTENCY_STORAGE_PREFIX}${workerId}`;

const createBrowserTabSessionId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `tab-${window.crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const createIdempotencyKey = (workerId) => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${workerId}-${window.crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `${workerId}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export default {
  name: 'HomeView',
  components: {
    ErrorBanner,
    UploadPanel,
    LoadingButton
  },
  data() {
    return {
      selectedFile: null,
      prevalidation: null,
      prevalidating: false,
      selectedWorkerId: 'mw-pr',
      creating: false,
      asking: false,
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
      prAuditorFinalPoFile: null,
      prAuditorEpmsFile: null,
      prAuditorPrModelFile: null,
      prAuditorFinalPoPrevalidation: null,
      prAuditorEpmsPrevalidation: null,
      prAuditorPrModelPrevalidation: null,
      prAuditorFinalPoPrevalidating: false,
      prAuditorEpmsPrevalidating: false,
      prAuditorPrModelPrevalidating: false,
      browserTabSessionId: '',
      activeSessionJobs: [],
      currentJobId: '',
      currentPrScope: 'TSS',
      currentStatus: '',
      currentProgress: null,
      updatedAt: '',
      connectionStatus: 'disconnected',
      events: [],
      jobDetail: null,
      reAskAnswer: null,
      chatMessages: [],
      health: null,
      healthError: false,
      errorMessage: '',
      errorNotificationId: 0,
      errorNotificationExpiresAt: 0,
      wsClient: null,
      currentPhase: '',
      commandText: '',
      commandNotice: '',
      consoleAutoStick: true,
      transientErrorTimer: null,
      chatMessageSequence: 0,
      mwPendingIdempotencyKey: '',
      ranPendingIdempotencyKey: '',
      prAuditorPendingIdempotencyKey: '',
      showCancelForm: false,
      cancellingRequest: false,
      cancelReasonCode: 'requested_by_user',
      cancelReasonText: ''
    };
  },
  computed: {
    isMwWorker() {
      return this.selectedWorkerId === 'mw-pr';
    },
    isRanWorker() {
      return this.selectedWorkerId === 'ran-pr';
    },
    isPrAuditorWorker() {
      return this.selectedWorkerId === 'pr-auditor';
    },
    activeWorkerLabel() {
      if (this.isPrAuditorWorker) {
        return 'PR Auditor';
      }

      return this.isRanWorker ? 'RAN PR Worker' : 'MW PR Worker';
    },
    activeModeLabel() {
      if (this.isPrAuditorWorker) {
        return 'Audit Run';
      }

      if (this.isRanWorker) {
        return this.ranRunMode === 'general-item' ? 'General Item' : 'Standard PR';
      }

      return this.generationScopeLabel;
    },
    activeWorkbenchTitle() {
      return this.isPrAuditorWorker ? 'PR Auditor' : 'PR Creator';
    },
    activeWorkbenchAriaLabel() {
      return this.isPrAuditorWorker ? 'PR Auditor workflow' : 'PR Creator workflow';
    },
    primaryActionLabel() {
      return this.isPrAuditorWorker ? 'Run Audit' : 'Create Job';
    },
    secondaryActionLabel() {
      return this.isPrAuditorWorker ? 'Run Another Audit' : 'Create Another Job';
    },
    readyActionText() {
      return this.isPrAuditorWorker ? 'Ready to run audit' : 'Ready to create Job';
    },
    idempotencyNotice() {
      return this.isPrAuditorWorker
        ? 'This Run Audit action will reuse the current idempotency key until you change inputs or choose Run Another Audit.'
        : 'This Create Job action will reuse the current idempotency key until you change inputs or choose Create Another Job.';
    },
    healthLabel() {
      if (this.health && this.health.status === 'ok') return '🟢Healthy';
      if (this.health && this.health.status === 'degraded') return '🟡Degraded';
      if (this.health && this.health.status === 'down') return '🔴Down';
      if (this.healthError) return '⚪Unavailable';
      return '🔵Checking';
    },
    activePendingIdempotencyKey() {
      if (this.isPrAuditorWorker) {
        return this.prAuditorPendingIdempotencyKey;
      }

      return this.isRanWorker ? this.ranPendingIdempotencyKey : this.mwPendingIdempotencyKey;
    },
    visibleActiveSessionJobs() {
      return this.activeSessionJobs.filter((job) => !isTerminalStatus(job.status));
    },
    hasActiveWorkerJob() {
      return Boolean(this.currentJobId) && !isTerminalStatus(this.currentStatus || (this.jobDetail && this.jobDetail.job ? this.jobDetail.job.status : ''));
    },
    workerFormLocked() {
      return this.creating;
    },
    cancellationMetadata() {
      return this.jobDetail && this.jobDetail.job ? this.jobDetail.job.cancellation || null : null;
    },
    canCreateJob() {
      if (this.creating) return false;

      if (this.isPrAuditorWorker) {
        if (!this.prAuditorFinalPoFile || !this.prAuditorEpmsFile || !this.prAuditorPrModelFile) return false;
        if (!this.prAuditorFinalPoPrevalidation || !this.prAuditorFinalPoPrevalidation.passed) return false;
        if (!this.prAuditorEpmsPrevalidation || !this.prAuditorEpmsPrevalidation.passed) return false;
        if (!this.prAuditorPrModelPrevalidation || !this.prAuditorPrModelPrevalidation.passed) return false;
        return true;
      }

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
      if (this.isPrAuditorWorker) {
        if (!this.prAuditorFinalPoFile || !this.prAuditorEpmsFile || !this.prAuditorPrModelFile) {
          return 'Upload Final PO, EPMS, and PR Model workbooks to start.';
        }
        if (this.prAuditorFinalPoPrevalidating || this.prAuditorEpmsPrevalidating || this.prAuditorPrModelPrevalidating) {
          return 'PR Auditor upload validation is in progress.';
        }
        if (!this.prAuditorFinalPoPrevalidation || !this.prAuditorEpmsPrevalidation || !this.prAuditorPrModelPrevalidation) {
          return 'Validate Final PO, EPMS, and PR Model workbooks before running the audit.';
        }
        if (!this.prAuditorFinalPoPrevalidation.passed || !this.prAuditorEpmsPrevalidation.passed || !this.prAuditorPrModelPrevalidation.passed) {
          return 'Validation failed; resolve the PR Auditor upload issues before running the audit.';
        }
        if (this.creating) return 'Submitting audit request.';
        return '';
      }

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
    siteCountPayload() {
      return {
        total: this.currentProgress && this.currentProgress.totalRows ? this.currentProgress.totalRows : 0,
        processed: this.currentProgress && this.currentProgress.processedRows ? this.currentProgress.processedRows : 0,
        failed: this.currentProgress && this.currentProgress.failedRows ? this.currentProgress.failedRows : 0
      };
    },
    outputCount() {
      if (this.jobDetail && this.jobDetail.job && this.hasValue(this.jobDetail.job.outputFileCount)) {
        return this.jobDetail.job.outputFileCount;
      }
      return this.jobDetail && this.jobDetail.outputs ? this.jobDetail.outputs.length : 0;
    },
    currentJobWorkerId() {
      return this.jobDetail && this.jobDetail.job ? (this.jobDetail.job.workerId || '') : '';
    },
    isPrAuditorCurrentJob() {
      return this.currentJobWorkerId === 'pr-auditor';
    },
    primaryDownloadFile() {
      if (!this.jobDetail || !Array.isArray(this.jobDetail.outputs)) {
        return null;
      }

      if (this.isPrAuditorCurrentJob) {
        return this.jobDetail.outputs.find((file) => file.fileType === 'pr_audit_result_xlsx' && file.available) || null;
      }

      return this.jobDetail.outputs.find((file) => file.fileType === 'zip_package' && file.available) || null;
    },
    canDownload() {
      return Boolean(this.primaryDownloadFile);
    },
    isCancelledResult() {
      return this.jobDetail && this.jobDetail.job && ['cancelled', 'cancelled_with_partial_result'].includes(this.jobDetail.job.status);
    },
    isPartialCancelledResult() {
      return this.jobDetail && this.jobDetail.job && this.jobDetail.job.status === 'cancelled_with_partial_result';
    },
    jobReady() {
      return this.jobDetail && this.jobDetail.job && ['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(this.jobDetail.job.status);
    },
    downloadUnavailableMessage() {
      const pendingFile = this.jobDetail && this.jobDetail.outputs
        ? this.jobDetail.outputs.find((file) => (
          this.isPrAuditorCurrentJob
            ? file.fileType === 'pr_audit_result_xlsx'
            : file.fileType === 'zip_package'
        ))
        : null;
      if (pendingFile && pendingFile.expired) return this.isPrAuditorCurrentJob ? 'Audit report has expired based on retention policy.' : 'ZIP has expired based on retention policy.';
      if (pendingFile && (pendingFile.deletedAt || pendingFile.cleanupReason)) return this.isPrAuditorCurrentJob ? 'Audit report is unavailable after retention cleanup.' : 'ZIP is unavailable after retention cleanup.';
      return this.isPrAuditorCurrentJob ? 'Audit report is not available yet.' : 'ZIP is not available yet.';
    },
    downloadUrl() {
      if (!this.currentJobId) return '#';
      if (this.isPrAuditorCurrentJob && this.primaryDownloadFile) {
        return getFileDownloadUrl(this.currentJobId, this.primaryDownloadFile.id);
      }
      return getZipDownloadUrl(this.currentJobId);
    },
    downloadButtonLabel() {
      if (this.isPrAuditorCurrentJob) {
        return 'Download Audit Report';
      }
      return this.isPartialCancelledResult ? 'Download Partial ZIP' : 'Download ZIP';
    },
    deliveryWarningMessage() {
      if (this.isPartialCancelledResult) {
        return 'Partial package only. This is not a completed delivery.';
      }
      if (this.isCancelledResult) {
        return 'This job was cancelled and is not a completed delivery.';
      }
      return '';
    },
    downloadProgressPercent() {
      if (this.jobReady) return 100;
      if (!this.currentJobId) return 0;
      if (!this.currentProgress) return null;

      const exact = this.currentProgress.percent ?? this.currentProgress.percentage ?? this.currentProgress.progressPercent;
      if (typeof exact === 'number' && Number.isFinite(exact)) {
        return Math.max(0, Math.min(100, Math.round(exact)));
      }

      const processed = Number(this.currentProgress.processedRows);
      const total = Number(this.currentProgress.totalRows);
      if (Number.isFinite(processed) && Number.isFinite(total) && total > 0) {
        return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
      }

      return null;
    },
    progressStateLabel() {
      if (!this.currentJobId) return 'Idle';
      if (this.jobReady) return 'Complete';
      return this.currentPhase || this.currentStatus || 'Running';
    },
    downloadProgressLabel() {
      if (!this.currentJobId) return 'No active Job';
      if (this.jobReady) return 'Result complete';
      return this.currentPhase || this.currentStatus || 'Processing';
    },
    resultCompletionMessage() {
      if (!this.jobDetail || !this.jobDetail.job) {
        return 'Outputs ready; warnings not available; review required not available.';
      }

      const job = this.jobDetail.job;
      if (job.status === 'failed') {
        return job.error && job.error.message ? job.error.message : 'Job failed before outputs were generated.';
      }
      if (job.status === 'cancelled') {
        return 'Job cancelled by user before a completed delivery was produced.';
      }
      if (job.status === 'cancelled_with_partial_result') {
        return 'Job cancelled by user after partial output was preserved. Review the package as partial only.';
      }

      if (job.workerId === 'pr-auditor') {
        const auditSummary = job.auditSummary || null;
        if (auditSummary) {
          return `Audit Result ready; Normal ${auditSummary.normalCount}, Invalid PO ${auditSummary.invalidPoCount}, Wrong PO ${auditSummary.wrongPoCount}, Duplicate PO ${auditSummary.duplicatePoCount}, Review Required ${auditSummary.reviewRequiredCount}, warnings ${auditSummary.warnings.length}.`;
        }
        return 'Audit report generated. Detailed findings are available in the workbook download.';
      }

      const outputs = this.hasValue(job.outputFileCount)
        ? job.outputFileCount
        : this.outputCount > 0
          ? this.outputCount
          : null;
      const warnings = this.hasValue(job.warningCount) ? job.warningCount : null;
      const reviewRequired = this.hasValue(job.reviewRequiredCount) ? job.reviewRequiredCount : null;

      const outputText = this.hasValue(outputs) ? `Outputs ${outputs}` : 'Outputs ready';
      const warningText = this.hasValue(warnings) ? `warnings ${warnings}` : 'warnings not available';
      const reviewText = this.hasValue(reviewRequired) ? `review required ${reviewRequired}` : 'review required not available';
      if (job.matchedSiteCount > 0 && outputs === 0) {
        if ((warnings || 0) > 0 || (reviewRequired || 0) > 0) {
          return `No ECC output generated; explained by ${warningText} and ${reviewText}.`;
        }
        return 'No ECC output generated and no warning or review explanation is available.';
      }
      return `${outputText}; ${warningText}; ${reviewText}.`;
    },
    resultTone() {
      const job = this.jobDetail && this.jobDetail.job ? this.jobDetail.job : {};
      if (job.status === 'failed') return 'danger';
      if (job.status === 'cancelled' || job.status === 'cancelled_with_partial_result') return 'warning';
      if (job.status === 'completed_with_warning') return 'warning';
      if (job.matchedSiteCount > 0 && job.outputFileCount === 0) return 'warning';
      return 'success';
    },
    downloadSummaryItems() {
      const job = this.jobDetail && this.jobDetail.job ? this.jobDetail.job : {};
      if (job.workerId === 'pr-auditor') {
        const auditSummary = job.auditSummary || null;
        return [
          { label: 'Audit reports', value: this.summaryValue(job.outputFileCount, this.outputCount) },
          { label: 'Normal', value: auditSummary ? auditSummary.normalCount : 'N/A' },
          { label: 'Invalid PO', value: auditSummary ? auditSummary.invalidPoCount : 'N/A' },
          { label: 'Wrong PO', value: auditSummary ? auditSummary.wrongPoCount : 'N/A' },
          { label: 'Duplicate PO', value: auditSummary ? auditSummary.duplicatePoCount : 'N/A' },
          { label: 'Review Required', value: this.summaryValue(job.reviewRequiredCount) },
          { label: 'Warnings', value: this.summaryValue(job.warningCount) }
        ];
      }

      return [
        { label: 'Requested sites', value: this.summaryValue(job.requestedSiteCount) },
        { label: 'Matched sites', value: this.summaryValue(job.matchedSiteCount) },
        { label: 'Unmatched sites', value: this.summaryValue(job.unmatchedSiteCount) },
        { label: 'Generated output files', value: this.summaryValue(job.outputFileCount, this.outputCount) },
        { label: 'Review Required items', value: this.summaryValue(job.reviewRequiredCount) },
        { label: 'Warnings', value: this.summaryValue(job.warningCount) }
      ];
    },
    consoleItems() {
      const items = [];

      items.push({
        id: 'session-ready',
        label: 'Workbench',
        title: 'Ready for source upload',
        body: 'Upload a source file, validate it, create a Job, then track progress and outputs here.',
        tone: 'info',
        time: ''
      });

      if (this.selectedFile) {
        items.push({
          id: 'file-selected',
          label: 'Upload',
          title: 'Source file selected',
          body: this.selectedFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.prevalidation) {
        items.push({
          id: 'validation-state',
          label: 'Validate',
          title: this.prevalidation.passed ? 'Validation passed' : 'Validation failed',
          body: this.prevalidation.workerExplanation || (this.prevalidation.passed ? 'The file is ready for Job creation.' : 'Review the validation checklist and correct the source file.'),
          tone: this.prevalidation.passed ? 'success' : 'danger',
          time: ''
        });
      }

      if (this.currentJobId) {
        items.push({
          id: 'job-created',
          label: 'Job',
          title: `Job ${this.currentJobId}`,
          body: `Status ${this.currentStatus || 'created'} with ${this.activeWorkerLabel} in ${this.activeModeLabel} mode.`,
          tone: 'info',
          time: this.updatedAt
        });
      }

      if (this.currentProgress) {
        const progressParts = [
          `Total ${this.siteCountPayload.total}`,
          `Processed ${this.siteCountPayload.processed}`,
          `Failed ${this.siteCountPayload.failed}`
        ];
        items.push({
          id: 'progress-state',
          label: 'Progress',
          title: this.currentPhase || this.currentStatus || 'Progress update',
          body: progressParts.join(' / '),
          tone: this.siteCountPayload.failed > 0 ? 'warning' : 'info',
          time: this.updatedAt
        });
      }

      this.events.slice().reverse().forEach((event, index) => {
        items.push({
          id: `event-${event.timestamp || index}-${event.type || 'message'}`,
          label: event.type || 'Event',
          title: event.status || event.currentPhase || 'Worker event',
          body: event.displayText || displayMessage(event),
          tone: event.status && event.status.toLowerCase().includes('fail') ? 'danger' : 'info',
          time: event.updatedAt || event.timestamp || ''
        });
      });

      if (this.jobDetail && this.jobDetail.job) {
        const job = this.jobDetail.job;
        items.push({
          id: 'result-state',
          label: 'Result',
          title: `Result ${job.status || 'available'}`,
          body: this.resultCompletionMessage,
          tone: this.resultTone,
          time: job.updatedAt || this.updatedAt
        });

        const finalSummary = this.jobDetail.finalWorkerSummary || job.finalWorkerSummary || '';
        if (isTerminalStatus(job.status) && finalSummary) {
          items.push({
            id: 'final-summary',
            label: 'AI Explanation',
            title: 'Final worker summary',
            body: finalSummary,
            tone: 'info',
            time: job.updatedAt || this.updatedAt
          });
        }

        if (job.error && job.error.message) {
          items.push({
            id: 'job-error',
            label: 'Error',
            title: 'Job error',
            body: job.error.message,
            tone: 'danger',
            time: job.updatedAt || this.updatedAt
          });
        }
      }

      this.chatMessages.forEach((message) => {
        items.push({
          id: message.id,
          label: message.role === 'user' ? 'User' : message.label || 'AI Response',
          title: message.role === 'user' ? 'Question' : 'Worker answer',
          body: message.body,
          tone: message.tone || (message.role === 'user' ? 'user' : 'success'),
          time: message.timestamp || '',
          role: message.role,
          meta: message.meta || ''
        });
      });

      return items;
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
  mounted() {
    if (typeof window !== 'undefined') {
      window.__AWP_HOME_VM__ = this;
    }
    this.initializeBrowserTabSessionId();
    this.initializePendingIdempotencyKeys();
    this.checkHealth();
    this.wsClient = new JobWebSocketClient({
      onMessage: this.handleWebSocketMessage,
      onStatus: (status) => {
        this.connectionStatus = status;
      }
    });
    this.restoreActiveJobs();
    this.$nextTick(() => {
      this.scrollConsoleToBottom(true);
    });
  },
  beforeDestroy() {
    this.clearTransientErrorTimer();
    if (this.wsClient) {
      this.wsClient.close();
    }
  },
  methods: {
    initializeBrowserTabSessionId() {
      const existing = sessionStorage.getItem(BROWSER_TAB_SESSION_STORAGE_KEY);

      if (existing) {
        this.browserTabSessionId = existing;
        return;
      }

      this.browserTabSessionId = createBrowserTabSessionId();
      sessionStorage.setItem(BROWSER_TAB_SESSION_STORAGE_KEY, this.browserTabSessionId);
    },
    initializePendingIdempotencyKeys() {
      this.mwPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('mw-pr')) || '';
      this.ranPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('ran-pr')) || '';
      this.prAuditorPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('pr-auditor')) || '';
    },
    setPendingIdempotencyKey(workerId, idempotencyKey) {
      const storageKey = buildWorkerIdempotencyStorageKey(workerId);
      sessionStorage.setItem(storageKey, idempotencyKey);

      if (workerId === 'pr-auditor') {
        this.prAuditorPendingIdempotencyKey = idempotencyKey;
        return;
      }

      if (workerId === 'ran-pr') {
        this.ranPendingIdempotencyKey = idempotencyKey;
        return;
      }

      this.mwPendingIdempotencyKey = idempotencyKey;
    },
    ensurePendingIdempotencyKey(workerId) {
      const currentValue = workerId === 'pr-auditor'
        ? this.prAuditorPendingIdempotencyKey
        : workerId === 'ran-pr'
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

      if (workerId === 'pr-auditor') {
        this.prAuditorPendingIdempotencyKey = '';
        return;
      }

      if (workerId === 'ran-pr') {
        this.ranPendingIdempotencyKey = '';
        return;
      }

      this.mwPendingIdempotencyKey = '';
    },
    getStoredSelectedJobId() {
      return sessionStorage.getItem(SELECTED_JOB_STORAGE_KEY) || '';
    },
    notifySelectedJobChange(jobId) {
      if (typeof window === 'undefined') {
        return;
      }

      window.dispatchEvent(new CustomEvent(SELECTED_JOB_CHANGED_EVENT, {
        detail: { jobId: jobId || '' }
      }));
    },
    rememberSelectedJobId(jobId) {
      this.currentJobId = jobId;
      sessionStorage.setItem(SELECTED_JOB_STORAGE_KEY, jobId);
      this.notifySelectedJobChange(jobId);
    },
    normalizeActiveSessionJobs(items = []) {
      return items
        .filter((job) => !isTerminalStatus(job.status))
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    },
    async restoreActiveJobs() {
      try {
        const result = await listJobs({
          workerType: 'pr-worker',
          browserTabSessionId: this.browserTabSessionId,
          limit: 50
        });
        this.activeSessionJobs = this.normalizeActiveSessionJobs(result.items || []);
      } catch (error) {
        this.activeSessionJobs = [];
        this.showWorkerNotification(getErrorMessage(error));
      }

      const storedJobId = this.getStoredSelectedJobId();
      const fallbackJobId = this.visibleActiveSessionJobs.length > 0 ? this.visibleActiveSessionJobs[0].jobId : '';
      const selectedJobId = this.visibleActiveSessionJobs.some((job) => job.jobId === storedJobId)
        ? storedJobId
        : fallbackJobId;

      if (!selectedJobId) {
        this.resetJobSession();
        return;
      }

      await this.selectActiveJob(selectedJobId);
    },
    async selectActiveJob(jobId) {
      this.rememberSelectedJobId(jobId);
      this.events = [];
      this.currentProgress = null;
      this.currentPhase = '';
      this.currentStatus = '';
      this.jobDetail = null;
      this.reAskAnswer = null;
      this.chatMessages = [];
      const selectedJob = this.activeSessionJobs.find((job) => job.jobId === jobId);
      if (selectedJob) {
        this.currentStatus = selectedJob.status;
        this.currentPrScope = selectedJob.prScope || this.currentPrScope;
      }
      if (this.wsClient) {
        this.wsClient.connect(jobId);
      }
      await this.refreshJobDetail();
    },
    upsertActiveSessionJob(job) {
      if (!job || !job.jobId) {
        return;
      }

      const remainingJobs = this.activeSessionJobs.filter((item) => item.jobId !== job.jobId);

      if (!isTerminalStatus(job.status)) {
        remainingJobs.push(job);
      }

      this.activeSessionJobs = this.normalizeActiveSessionJobs(remainingJobs);
    },
    removeActiveSessionJob(jobId) {
      this.activeSessionJobs = this.activeSessionJobs.filter((job) => job.jobId !== jobId);
    },
    resetJobSession() {
      this.currentJobId = '';
      sessionStorage.removeItem(SELECTED_JOB_STORAGE_KEY);
      this.notifySelectedJobChange('');
      this.currentStatus = '';
      this.currentProgress = null;
      this.jobDetail = null;
      this.events = [];
      this.currentPrScope = 'TSS';
      this.errorMessage = '';
      this.commandNotice = '';
      this.reAskAnswer = null;
      this.chatMessages = [];
      this.currentPhase = '';
      this.resetCancellationForm();
    },
    resetCancellationForm() {
      this.showCancelForm = false;
      this.cancellingRequest = false;
      this.cancelReasonCode = 'requested_by_user';
      this.cancelReasonText = '';
    },
    beginCreateAnotherJob() {
      this.resetPendingIdempotencyKey(this.selectedWorkerId);
    },
    isJobCancellable(job) {
      return Boolean(job) && !isTerminalStatus(job.status);
    },
    async prepareCancellationForJob(jobId) {
      if (this.currentJobId !== jobId) {
        await this.selectActiveJob(jobId);
      }
      this.showCancelForm = true;
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

      if (workerId === 'pr-auditor') {
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
    async checkHealth() {
      try {
        this.health = await getHealth();
        this.healthError = false;
      } catch (error) {
        this.health = null;
        this.healthError = true;
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
    onPrAuditorFileSelected(kind, file) {
      if (kind === 'finalPo') {
        this.prAuditorFinalPoFile = file;
        this.prAuditorFinalPoPrevalidation = null;
      } else if (kind === 'epms') {
        this.prAuditorEpmsFile = file;
        this.prAuditorEpmsPrevalidation = null;
      } else {
        this.prAuditorPrModelFile = file;
        this.prAuditorPrModelPrevalidation = null;
      }

      this.resetPendingIdempotencyKey('pr-auditor');
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
    async prevalidatePrAuditorUpload(kind, file) {
      if (!file) {
        const label = kind === 'finalPo' ? 'Final PO' : kind === 'epms' ? 'EPMS' : 'PR Model';
        this.errorMessage = `Select a ${label} file first.`;
        return;
      }

      if (kind === 'finalPo') {
        this.prAuditorFinalPoPrevalidating = true;
      } else if (kind === 'epms') {
        this.prAuditorEpmsPrevalidating = true;
      } else {
        this.prAuditorPrModelPrevalidating = true;
      }
      this.errorMessage = '';

      const uploadKind = kind === 'finalPo'
        ? 'pr-auditor-final-po'
        : kind === 'epms'
          ? 'pr-auditor-epms'
          : 'pr-auditor-pr-model';

      try {
        const result = await prevalidateUpload(file, uploadKind, {
          workerId: 'pr-auditor',
          browserTabSessionId: this.browserTabSessionId
        });

        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidation = result;
        } else if (kind === 'epms') {
          this.prAuditorEpmsPrevalidation = result;
        } else {
          this.prAuditorPrModelPrevalidation = result;
        }
      } catch (error) {
        const fallback = this.getSafePrevalidationPayload(error);
        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidation = fallback;
        } else if (kind === 'epms') {
          this.prAuditorEpmsPrevalidation = fallback;
        } else {
          this.prAuditorPrModelPrevalidation = fallback;
        }
        if (!this.isExpectedPrevalidationFailure(error)) {
          this.errorMessage = getErrorMessage(error);
        }
      } finally {
        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidating = false;
        } else if (kind === 'epms') {
          this.prAuditorEpmsPrevalidating = false;
        } else {
          this.prAuditorPrModelPrevalidating = false;
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
    hasValue(value) {
      return value !== undefined && value !== null && value !== '';
    },
    summaryValue(value, fallback = null) {
      if (this.hasValue(value)) return value;
      if (this.hasValue(fallback)) return fallback;
      return 0;
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
        const workerId = this.isPrAuditorWorker ? 'pr-auditor' : this.isRanWorker ? 'ran-pr' : 'mw-pr';
        const idempotencyKey = this.ensurePendingIdempotencyKey(workerId);
        const payload = this.isPrAuditorWorker
          ? {
              workerId,
              browserTabSessionId: this.browserTabSessionId,
              idempotencyKey,
              finalPoPrevalidatedFileId: this.prAuditorFinalPoPrevalidation.prevalidatedFileId,
              epmsPrevalidatedFileId: this.prAuditorEpmsPrevalidation.prevalidatedFileId,
              prModelPrevalidatedFileId: this.prAuditorPrModelPrevalidation.prevalidatedFileId
            }
          : this.isRanWorker
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
        this.currentPrScope = result.job.prScope || (this.isRanWorker ? 'RAN' : this.isPrAuditorWorker ? 'AUDIT' : this.prScope);
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
    },
    async submitCancellationRequest() {
      if (!this.currentJobId || this.cancellingRequest) return;

      this.cancellingRequest = true;
      this.dismissErrorMessage();
      try {
        const result = await cancelJob(this.currentJobId, {
          reasonCode: this.cancelReasonCode,
          reasonText: this.cancelReasonCode === 'other' ? this.cancelReasonText : ''
        });
        this.currentStatus = result.job.status;
        this.upsertActiveSessionJob(result.job);
        this.showCancelForm = false;
        await this.refreshJobDetail();
      } catch (error) {
        this.showWorkerNotification(getErrorMessage(error));
      } finally {
        this.cancellingRequest = false;
      }
    },
    async refreshJobDetail() {
      if (!this.currentJobId) return;
      try {
        this.jobDetail = await getJobDetail(this.currentJobId);
        if (this.jobDetail && this.jobDetail.job) {
          this.currentStatus = this.jobDetail.job.status;
          this.currentPrScope = this.jobDetail.job.prScope || this.currentPrScope;
          this.currentPhase = this.jobDetail.job.phase || '';
          this.upsertActiveSessionJob(this.jobDetail.job);
          if (isTerminalStatus(this.jobDetail.job.status)) {
            this.removeActiveSessionJob(this.jobDetail.job.jobId);
          }
        }
      } catch (error) {
        this.showWorkerNotification(getErrorMessage(error));
      }
    },
    handleWebSocketMessage(message) {
      if (message.type === 'ERROR') {
        this.showWorkerNotification(message.message || 'Realtime connection error.');
        return;
      }

      if (message.type === 'SUBSCRIBED') {
        this.applySnapshot(message.state);
        return;
      }

      if (message.type === 'JOB_EVENT' || message.type === 'JOB_HEARTBEAT') {
        this.applyRealtimeMessage(message);
      }
    },
    applySnapshot(state) {
      if (!state) return;
      this.currentStatus = state.status || this.currentStatus;
      this.currentProgress = state.progress || this.currentProgress;
      this.currentPhase = state.currentPhase || this.currentPhase || '';
      this.updatedAt = state.updatedAt || '';
      this.events = (state.events || []).map((event) => ({
        ...event,
        displayText: displayMessage(event)
      })).slice(0, 50);
    },
    applyRealtimeMessage(message) {
      this.currentStatus = message.status || this.currentStatus;
      this.currentPhase = message.currentPhase || this.currentPhase || '';
      this.currentProgress = message.progress || this.currentProgress;
      this.updatedAt = message.updatedAt || message.timestamp || '';

      const eventItem = {
        ...message,
        displayText: displayMessage(message)
      };

      this.events = [eventItem, ...this.events].slice(0, 50);
      const existingJob = this.activeSessionJobs.find((job) => job.jobId === this.currentJobId) || {};
      this.upsertActiveSessionJob({
        ...existingJob,
        jobId: this.currentJobId,
        status: this.currentStatus,
        workerId: existingJob.workerId || (this.jobDetail && this.jobDetail.job ? this.jobDetail.job.workerId : this.selectedWorkerId),
        workerDisplayName: existingJob.workerDisplayName || (this.jobDetail && this.jobDetail.job ? this.jobDetail.job.workerDisplayName : this.activeWorkerLabel),
        createdAt: existingJob.createdAt || this.updatedAt,
        prScope: existingJob.prScope || this.currentPrScope
      });

      if (isTerminalStatus(message.status)) {
        this.refreshJobDetail();
        this.restoreActiveJobs();
      }
    },
    async askQuestion(question) {
      if (!this.currentJobId || !question.trim()) return;
      this.asking = true;
      this.dismissErrorMessage();
      try {
        const answer = await askJob(this.currentJobId, question);
        this.reAskAnswer = answer;
        this.appendChatMessage({
          role: 'assistant',
          body: answer.answer || answer.message || JSON.stringify(answer),
          tone: 'success',
          label: 'AI Response',
          meta: [answer.answerSource, answer.llmStatus].filter(Boolean).join(' / ')
        });
      } catch (error) {
        const isTimeout = error && (
          isWorkerTimeoutError(error)
        );
        const message = isTimeout
          ? WORKER_TIMEOUT_NOTIFICATION_MESSAGE
          : getErrorMessage(error);
        this.showWorkerNotification(message);
      } finally {
        this.asking = false;
      }
    },
    async submitCommand() {
      const question = this.commandText.trim();
      if (!question) return;
      if (!this.currentJobId) {
        this.commandNotice = 'Create a Job before sending AI follow-up questions. You can use this field to prepare the prompt now.';
        return;
      }
      this.commandNotice = '';
      this.appendChatMessage({
        role: 'user',
        body: question,
        tone: 'user',
        label: 'User'
      });
      await this.askQuestion(question);
      if (!this.errorMessage) {
        this.commandText = '';
      }
    },
    onConsoleScroll() {
      const el = this.$refs.consoleBody;
      if (!el) return;
      this.consoleAutoStick = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    },
    scrollConsoleToBottom(force) {
      const el = this.$refs.consoleBody;
      if (!el || (!force && !this.consoleAutoStick)) return;
      el.scrollTop = el.scrollHeight;
    },
    appendChatMessage({ role, body, tone, label, meta }) {
      this.chatMessageSequence += 1;
      this.chatMessages.push({
        id: `chat-${Date.now()}-${this.chatMessageSequence}`,
        role,
        body,
        tone,
        label,
        meta,
        timestamp: new Date().toLocaleTimeString()
      });
      this.consoleAutoStick = true;
      this.$nextTick(() => {
        this.scrollConsoleToBottom(true);
      });
    },
    clearTransientErrorTimer() {
      if (this.transientErrorTimer) {
        window.clearTimeout(this.transientErrorTimer);
        this.transientErrorTimer = null;
      }
    },
    dismissErrorMessage() {
      this.clearTransientErrorTimer();
      this.errorNotificationExpiresAt = 0;
      this.errorMessage = '';
    },
    getWorkerNotificationMessage(error) {
      if (isWorkerTimeoutError(error)) {
        return WORKER_TIMEOUT_NOTIFICATION_MESSAGE;
      }

      return getErrorMessage(error);
    },
    showWorkerNotification(message) {
      if (!message) {
        this.dismissErrorMessage();
        return;
      }

      if (this.errorMessage === message && this.transientErrorTimer) {
        return;
      }

      this.clearTransientErrorTimer();
      this.errorNotificationId += 1;
      const notificationId = this.errorNotificationId;
      this.errorMessage = message;
      const scheduledDismiss = scheduleNotificationDismiss({
        activeNotificationId: notificationId,
        clearTimer: (timer) => window.clearTimeout(timer),
        currentTimer: this.transientErrorTimer,
        onDismiss: (dismissedNotificationId) => {
          if (this.errorNotificationId === dismissedNotificationId) {
            this.dismissErrorMessage();
          }
        },
        setTimer: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
        timeoutMs: WORKER_NOTIFICATION_TIMEOUT_MS
      });
      this.errorNotificationExpiresAt = scheduledDismiss.expiresAt;
      this.transientErrorTimer = scheduledDismiss.timer;
    },
    setTransientError(message) {
      this.showWorkerNotification(message);
    }
  }
};
</script>
