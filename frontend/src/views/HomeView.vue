<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="errorMessage"
      :dismissible="Boolean(errorMessage)"
      @dismiss="dismissErrorMessage"
    />

    <section class="workbench-hero" aria-label="AI Worker PR Creator workbench">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>Turn site exports into PR-ready worker jobs.</h2>
        <p class="workbench-subtitle">
          Upload, validate, scope, and launch TSS or TI generation from one polished operational workbench.
        </p>

        <div class="workbench-chip-row" aria-label="Workflow status">
          <span class="workbench-chip">Upload</span>
          <span class="workbench-chip">Validate</span>
          <span class="workbench-chip">{{ generationScopeLabel }}</span>
          <span class="workbench-chip">{{ healthLabel }}</span>
        </div>

        <div class="workbench-action-row" aria-label="Primary actions">
          <a class="workbench-primary-link" href="#pr-creator-workbench">Create PR Job</a>
          <a class="workbench-secondary-link" href="#worker-console">View Live Output</a>
        </div>
      </div>

      <section id="pr-creator-workbench" class="workbench-surface" aria-label="PR Creator workflow">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Operational Workflow</p>
            <h3>PR Creator</h3>
          </div>
          <span class="workbench-status-pill">{{ progressStateLabel }}</span>
        </div>

        <div class="workbench-main-grid">
          <UploadPanel
            class="cockpit-card upload-card workbench-upload-card"
            :result="prevalidation"
            :loading="prevalidating"
            :disable-action="creating"
            @file-selected="onFileSelected"
            @prevalidate="prevalidate"
          />

          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Job Scope</span>
              <small>{{ generationScopeLabel }}</small>
            </div>

            <div class="workbench-config-grid">
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
                    v-for="option in workerOptions"
                    :key="option"
                    type="button"
                    :class="{ active: prScope === option }"
                    @click="prScope = option"
                  >
                    {{ option }}
                  </button>
                </div>
              </div>
            </div>

            <div class="cockpit-field-group workbench-sites-field">
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

            <div class="workbench-create-row">
              <LoadingButton
                label="Create Job"
                loading-text="Creating..."
                :loading="creating"
                :disabled="!canCreateJob"
                @click="createWorkerJob"
              />
              <p v-if="createDisabledReason" class="cockpit-note">{{ createDisabledReason }}</p>
              <p v-else class="cockpit-ready">Ready to create Job</p>
            </div>
          </section>
        </div>

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
            <a
              v-if="canDownload"
              class="download-button"
              :href="downloadUrl"
            >
              Download ZIP
            </a>
            <p v-else class="cockpit-note">{{ downloadUnavailableMessage }}</p>
            <p v-if="jobReady && !canDownload" class="cockpit-note">Output delivery is complete for this Job.</p>
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
import { createJob, getErrorMessage, getHealth, getJobDetail, getZipDownloadUrl, prevalidateUpload } from '../api/jobApi';
import { askJob } from '../api/reAskApi';
import { displayMessage, isTerminalStatus } from '../utils/statusUtils';
import {
  scheduleNotificationDismiss,
  isWorkerTimeoutError,
  WORKER_NOTIFICATION_TIMEOUT_MS,
  WORKER_TIMEOUT_NOTIFICATION_MESSAGE
} from '../utils/workerNotificationUtils';

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
      creating: false,
      asking: false,
      prScope: 'TSS',
      generationScope: 'site_code',
      siteCodesText: '',
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
      workerOptions: ['TSS', 'TI'],
      transientErrorTimer: null,
      chatMessageSequence: 0
    };
  },
  computed: {
    healthLabel() {
      if (this.health && this.health.status === 'ok') return '🟢Healthy';
      if (this.health && this.health.status === 'degraded') return '🟡Degraded';
      if (this.health && this.health.status === 'down') return '🔴Down';
      if (this.healthError) return '⚪Unavailable';
      return '🔵Checking';
    },
    canCreateJob() {
      if (!this.prevalidation || !this.prevalidation.passed || this.creating) return false;
      if (this.generationScope === 'site_code' && this.parseSiteCodes().length === 0) return false;
      if (!this.selectedFile) return false;
      return true;
    },
    createDisabledReason() {
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
    canDownload() {
      return this.jobDetail && this.jobDetail.outputs && this.jobDetail.outputs.some((file) => file.fileType === 'zip_package' && file.available);
    },
    jobReady() {
      return this.jobDetail && this.jobDetail.job && ['completed', 'completed_with_warning', 'failed', 'cancelled', 'cancelled_with_partial_result'].includes(this.jobDetail.job.status);
    },
    downloadUnavailableMessage() {
      const zip = this.jobDetail && this.jobDetail.outputs
        ? this.jobDetail.outputs.find((file) => file.fileType === 'zip_package')
        : null;
      if (zip && zip.expired) return 'ZIP has expired based on retention policy.';
      if (zip && (zip.deletedAt || zip.cleanupReason)) return 'ZIP is unavailable after retention cleanup.';
      return 'ZIP is not available yet.';
    },
    downloadUrl() {
      return this.currentJobId ? getZipDownloadUrl(this.currentJobId) : '#';
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
      if (job.status === 'completed_with_warning') return 'warning';
      if (job.matchedSiteCount > 0 && job.outputFileCount === 0) return 'warning';
      return 'success';
    },
    downloadSummaryItems() {
      const job = this.jobDetail && this.jobDetail.job ? this.jobDetail.job : {};
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
          body: `Status ${this.currentStatus || 'created'} with ${this.generationScopeLabel.toLowerCase()} mode and ${this.currentPrScope || this.prScope} worker scope.`,
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
    }
  },
  mounted() {
    this.checkHealth();
    this.wsClient = new JobWebSocketClient({
      onMessage: this.handleWebSocketMessage,
      onStatus: (status) => {
        this.connectionStatus = status;
      }
    });
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
      this.currentJobId = '';
      localStorage.removeItem('currentJobId');
      this.currentStatus = '';
      this.currentProgress = null;
      this.jobDetail = null;
      this.events = [];
      this.currentPrScope = 'TSS';
      this.errorMessage = '';
      this.commandNotice = '';
      this.reAskAnswer = null;
      this.chatMessages = [];
    },
    async prevalidate(file) {
      if (!file) {
        this.errorMessage = 'Select an input file first.';
        return;
      }
      this.prevalidating = true;
      this.errorMessage = '';
      try {
        this.prevalidation = await prevalidateUpload(file);
      } catch (error) {
        this.prevalidation = error.response && error.response.data ? error.response.data : null;
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.prevalidating = false;
      }
    },
    parseSiteCodes() {
      return this.siteCodesText
        .split(/[\s,]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .filter((item, index, items) => items.indexOf(item) === index);
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
      try {
        const result = await createJob({
          prevalidatedFileId: this.prevalidation.prevalidatedFileId,
          prScope: this.prScope,
          generationScope: this.generationScope,
          siteCodes: this.generationScope === 'site_code' ? this.parseSiteCodes() : []
        });
        this.currentJobId = result.job.jobId;
        localStorage.setItem('currentJobId', result.job.jobId);
        this.currentPrScope = result.job.prScope || this.prScope;
        this.currentStatus = result.job.status;
        this.currentPhase = result.job.phase || '';
        this.consoleAutoStick = true;
        this.wsClient.connect(this.currentJobId);
      } catch (error) {
        this.showWorkerNotification(this.getWorkerNotificationMessage(error));
      } finally {
        this.creating = false;
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

      if (isTerminalStatus(message.status)) {
        this.refreshJobDetail();
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
