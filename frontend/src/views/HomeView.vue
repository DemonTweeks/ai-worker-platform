<template>
  <div class="portal-shell home-page">
    <ErrorBanner :message="errorMessage" />

    <section class="hero-band">
      <div class="hero-copy">
        <p class="eyebrow">AI Worker Control Console</p>
        <h1>Job Workspace</h1>
        <p class="hero-subtitle">Upload source data, validate it, create a Job, then review outputs in one structured flow.</p>
      </div>
      <div class="status-strip" :class="{ ok: health && health.status === 'ok', warning: health && health.status === 'degraded', error: healthError || health && health.status === 'down' }">
        <span class="status-strip-label">Backend status</span>
        <strong>{{ healthLabel }}</strong>
      </div>
    </section>

    <section v-if="!hasActivity" class="panel intro-panel">
      <h2>Start with this flow</h2>
      <ol class="ordered-steps">
        <li>Upload a source export file.</li>
        <li>Run validation and check for file issues.</li>
        <li>Create the Job when validation is green.</li>
        <li>Track progress, review results, and download outputs.</li>
      </ol>
      <p class="muted">This interface is optimized for internal management review and operations workflows.</p>
    </section>

    <div class="workflow-grid">
      <div class="primary-flow">
        <UploadPanel
          :result="prevalidation"
          :loading="prevalidating"
          :disable-action="creating"
          @file-selected="onFileSelected"
          @prevalidate="prevalidate"
        />

        <section class="panel step-settings">
          <div class="panel-heading">
            <span class="step-marker">2</span>
            <h2>Job Configuration</h2>
          </div>
          <div class="config-grid">
            <ScopeSelector v-model="prScope" />
            <SiteSelector
              :mode="generationScope"
              :site-codes-text="siteCodesText"
              @mode-change="generationScope = $event"
              @site-codes-change="siteCodesText = $event"
            />
          </div>
          <p class="helper-text">Step 2 is required before creating the Job. All-scope jobs can be run across all sites when no specific site code list is provided.</p>
        </section>

        <section class="panel action-panel">
          <div class="panel-heading">
            <span class="step-marker">3</span>
            <h2>Create Job</h2>
          </div>
          <LoadingButton
            label="Create PR Worker Job"
            loading-text="Creating..."
            :loading="creating"
            :disabled="!canCreateJob"
            @click="createWorkerJob"
          />
          <p v-if="createDisabledReason" class="field-hint">{{ createDisabledReason }}</p>
          <p v-else class="success-text">All requirements are met. Ready to create this Job.</p>

          <div class="job-meta-grid">
            <div>
              <span class="meta-label">Current Job</span>
              <strong>{{ currentJobId || 'Not created' }}</strong>
            </div>
            <div>
              <span class="meta-label">Scope</span>
              <strong>{{ prScope }}</strong>
            </div>
            <div>
              <span class="meta-label">Mode</span>
              <strong>{{ generationScopeLabel }}</strong>
            </div>
          </div>
        </section>

        <section class="panel">
          <JobProgress
            :job-id="currentJobId"
            :pr-scope="currentPrScope"
            :status="currentStatus"
            :connection-status="connectionStatus"
            :latest-message="latestMessage"
            :progress="currentProgress"
            :updated-at="updatedAt"
            :events="events"
            :site-counts="siteCountPayload"
          />
        </section>

        <JobEventTimeline :events="events" />
      </div>

      <aside class="side-flow">
        <section class="panel compact-status">
          <h2>Result Readiness</h2>
          <p v-if="currentStatus">Current status: <strong>{{ currentStatus }}</strong></p>
          <p v-else class="muted">Create a Job to activate result tracking and output actions.</p>
          <p class="muted">Use this panel to review summaries and quickly access the ZIP package.</p>
        </section>
        <FinalSummary :detail="jobDetail" />
        <DownloadPanel :job-id="currentJobId" :detail="jobDetail" />
        <ReAskPanel
          :job-id="currentJobId"
          :loading="asking"
          :answer="reAskAnswer"
          @ask="askQuestion"
        />
      </aside>
    </div>
  </div>
</template>

<script>
import UploadPanel from '../components/UploadPanel.vue';
import ScopeSelector from '../components/ScopeSelector.vue';
import SiteSelector from '../components/SiteSelector.vue';
import JobProgress from '../components/JobProgress.vue';
import JobEventTimeline from '../components/JobEventTimeline.vue';
import FinalSummary from '../components/FinalSummary.vue';
import DownloadPanel from '../components/DownloadPanel.vue';
import ReAskPanel from '../components/ReAskPanel.vue';
import ErrorBanner from '../components/ErrorBanner.vue';
import LoadingButton from '../components/LoadingButton.vue';
import JobWebSocketClient from '../services/websocketClient';
import { createJob, getErrorMessage, getHealth, getJobDetail, prevalidateUpload } from '../api/jobApi';
import { askJob } from '../api/reAskApi';
import { displayMessage, isTerminalStatus } from '../utils/statusUtils';

export default {
  name: 'HomeView',
  components: {
    DownloadPanel,
    ErrorBanner,
    FinalSummary,
    JobEventTimeline,
    JobProgress,
    ReAskPanel,
    ScopeSelector,
    SiteSelector,
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
      health: null,
      healthError: false,
      errorMessage: '',
      wsClient: null,
      currentPhase: ''
    };
  },
  computed: {
    healthLabel() {
      if (this.health && this.health.status === 'ok') return 'Healthy';
      if (this.health && this.health.status === 'degraded') return 'Degraded';
      if (this.health && this.health.status === 'down') return 'Down';
      if (this.healthError) return 'Unavailable';
      return 'Checking';
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
      if (!this.prevalidation) return 'Run prevalidation before creating a Job.';
      if (!this.prevalidation.passed) return 'Prevalidation failed; resolve listed issues and upload again or correct the source.';
      if (this.generationScope === 'site_code' && this.parseSiteCodes().length === 0) return 'Add at least one site code for specific-site mode.';
      if (this.creating) return 'Submitting job request.';
      return '';
    },
    generationScopeLabel() {
      return this.generationScope === 'all_sites' ? 'All Sites' : 'Specific Sites';
    },
    siteCountPayload() {
      return {
        total: this.currentProgress && this.currentProgress.totalRows ? this.currentProgress.totalRows : 0,
        processed: this.currentProgress && this.currentProgress.processedRows ? this.currentProgress.processedRows : 0,
        failed: this.currentProgress && this.currentProgress.failedRows ? this.currentProgress.failedRows : 0
      };
    },
    hasActivity() {
      return Boolean(this.currentJobId || this.jobDetail || this.currentStatus || this.selectedFile);
    },
    latestMessage() {
      if (this.events.length > 0) {
        return this.events[0].displayText;
      }
      if (this.currentJobId) {
        return 'Job created. Waiting for live updates.';
      }
      return 'Upload and validate a file to begin.';
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
  },
  beforeDestroy() {
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
      this.currentStatus = '';
      this.currentProgress = null;
      this.jobDetail = null;
      this.events = [];
      this.currentPrScope = 'TSS';
      this.errorMessage = '';
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
    async createWorkerJob() {
      if (!this.canCreateJob) return;
      this.creating = true;
      this.errorMessage = '';
      this.events = [];
      this.jobDetail = null;
      this.reAskAnswer = null;
      try {
        const result = await createJob({
          prevalidatedFileId: this.prevalidation.prevalidatedFileId,
          prScope: this.prScope,
          generationScope: this.generationScope,
          siteCodes: this.generationScope === 'site_code' ? this.parseSiteCodes() : []
        });
        this.currentJobId = result.job.jobId;
        this.currentPrScope = result.job.prScope || this.prScope;
        this.currentStatus = result.job.status;
        this.currentPhase = result.job.phase || '';
        this.wsClient.connect(this.currentJobId);
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
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
        this.errorMessage = getErrorMessage(error);
      }
    },
    handleWebSocketMessage(message) {
      if (message.type === 'ERROR') {
        this.errorMessage = message.message || 'Realtime connection error.';
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
      this.errorMessage = '';
      try {
        this.reAskAnswer = await askJob(this.currentJobId, question);
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.asking = false;
      }
    }
  }
};
</script>
