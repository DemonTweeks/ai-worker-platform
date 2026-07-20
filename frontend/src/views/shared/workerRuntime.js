import JobWebSocketClient from '../../services/websocketClient';
import {
  cancelJob,
  getErrorMessage,
  getFileDownloadUrl,
  getHealth,
  getJobDetail,
  getZipDownloadUrl,
  listJobs
} from '../../api/jobApi';
import { askJob } from '../../api/reAskApi';
import { displayMessage, isTerminalStatus } from '../../utils/statusUtils';
import { hasAuditReport, prAuditorReportMessage } from '../../utils/prAuditorResultUtils';
import {
  scheduleNotificationDismiss,
  isWorkerTimeoutError,
  WORKER_NOTIFICATION_TIMEOUT_MS,
  WORKER_TIMEOUT_NOTIFICATION_MESSAGE
} from '../../utils/workerNotificationUtils';

export const BROWSER_TAB_SESSION_STORAGE_KEY = 'browserTabSessionId';
export const SELECTED_JOB_STORAGE_KEY = 'selectedJobId';
export const WORKER_IDEMPOTENCY_STORAGE_PREFIX = 'workerCreateIdempotencyKey:';
export const SELECTED_JOB_CHANGED_EVENT = 'awp:selected-job-changed';

export const buildWorkerIdempotencyStorageKey = (workerId) => `${WORKER_IDEMPOTENCY_STORAGE_PREFIX}${workerId}`;

export const createBrowserTabSessionId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `tab-${window.crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const createIdempotencyKey = (workerId) => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${workerId}-${window.crypto.randomUUID().replace(/-/g, '')}`;
  }

  return `${workerId}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const workerRuntimeMixin = {
  data() {
    return {
      creating: false,
      asking: false,
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
      showCancelForm: false,
      cancellingRequest: false,
      cancelReasonCode: 'requested_by_user',
      cancelReasonText: ''
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
        return job.failureSummary || (job.error && job.error.message ? job.error.message : 'Job failed before outputs were generated.');
      }
      if (job.status === 'cancelled') {
        return 'Job cancelled by user before a completed delivery was produced.';
      }
      if (job.status === 'cancelled_with_partial_result') {
        return 'Job cancelled by user after partial output was preserved. Review the package as partial only.';
      }

      if (job.workerId === 'pr-auditor') {
        const outputs = this.jobDetail && Array.isArray(this.jobDetail.outputs) ? this.jobDetail.outputs : [];
        if (!hasAuditReport(job, outputs)) {
          return prAuditorReportMessage(job, outputs);
        }
        const auditSummary = job.auditSummary || null;
        if (auditSummary) {
          return `Audit Result ready; Normal ${auditSummary.normalCount}, Invalid PO ${auditSummary.invalidPoCount}, Wrong PO ${auditSummary.wrongPoCount}, Duplicate PO ${auditSummary.duplicatePoCount}, Review Required ${auditSummary.reviewRequiredCount}, warnings ${auditSummary.warnings.length}.`;
        }
        return prAuditorReportMessage(job, outputs);
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
    }
  },
  mounted() {
    if (typeof window !== 'undefined') {
      window.__AWP_WORKER_VM__ = this;
    }
    this.initializeBrowserTabSessionId();
    if (typeof this.initializePendingIdempotencyKeys === 'function') {
      this.initializePendingIdempotencyKeys();
    }
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
    async viewLiveOutput(jobId) {
      await this.selectActiveJob(jobId);
      await this.$nextTick();
      if (this.$refs.workerConsole) {
        this.$refs.workerConsole.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
      if (typeof this.resetActivePendingIdempotencyKey === 'function') {
        this.resetActivePendingIdempotencyKey();
      }
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
    async checkHealth() {
      try {
        this.health = await getHealth();
        this.healthError = false;
      } catch (error) {
        this.health = null;
        this.healthError = true;
      }
    },
    hasValue(value) {
      return value !== undefined && value !== null && value !== '';
    },
    summaryValue(value, fallback = null) {
      if (this.hasValue(value)) return value;
      if (this.hasValue(fallback)) return fallback;
      return 0;
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
        workerId: existingJob.workerId || (this.jobDetail && this.jobDetail.job ? this.jobDetail.job.workerId : ''),
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
        const message = isWorkerTimeoutError(error)
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
    buildSharedConsoleItems() {
      const items = [];

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

        const failureMessage = job.failureSummary || (job.error && job.error.message ? job.error.message : '');
        if (failureMessage) {
          items.push({
            id: 'job-error',
            label: 'Error',
            title: 'Job error',
            body: failureMessage,
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
