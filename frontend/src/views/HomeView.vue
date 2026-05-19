<template>
  <div class="portal-shell">
    <ErrorBanner :message="errorMessage" />

    <section class="hero-band">
      <div>
        <p class="eyebrow">Normal user portal</p>
        <h1>AI Worker Platform — PR Worker</h1>
      </div>
      <div class="health-pill" :class="{ ok: health && health.status === 'ok', error: healthError }">
        Backend: {{ healthLabel }}
      </div>
    </section>

    <div class="workflow-grid">
      <div class="primary-flow">
        <UploadPanel
          :result="prevalidation"
          :loading="prevalidating"
          @file-selected="onFileSelected"
          @prevalidate="prevalidate"
        />

        <div class="config-grid">
          <ScopeSelector v-model="prScope" />
          <SiteSelector
            :mode="generationScope"
            :site-codes-text="siteCodesText"
            @mode-change="generationScope = $event"
            @site-codes-change="siteCodesText = $event"
          />
        </div>

        <section class="panel action-panel">
          <div class="panel-heading">
            <span class="step-marker">4</span>
            <h2>Run Job</h2>
          </div>
          <LoadingButton
            label="Create PR Worker Job"
            loading-text="Creating..."
            :loading="creating"
            :disabled="!canCreateJob"
            @click="createWorkerJob"
          />
          <p v-if="currentJobId" class="muted">Current job: {{ currentJobId }}</p>
          <p class="muted">Selected scope: {{ prScope }}</p>
        </section>

        <JobProgress
          :job-id="currentJobId"
          :pr-scope="currentPrScope"
          :status="currentStatus"
          :connection-status="connectionStatus"
          :latest-message="latestMessage"
          :progress="currentProgress"
          :updated-at="updatedAt"
        />

        <JobEventTimeline :events="events" />
      </div>

      <aside class="side-flow">
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
    LoadingButton,
    ReAskPanel,
    ScopeSelector,
    SiteSelector,
    UploadPanel
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
      wsClient: null
    };
  },
  computed: {
    healthLabel() {
      if (this.health && this.health.status === 'ok') return 'healthy';
      if (this.healthError) return 'unavailable';
      return 'checking';
    },
    canCreateJob() {
      if (!this.prevalidation || !this.prevalidation.passed || this.creating) return false;
      if (this.generationScope === 'site_code' && this.parseSiteCodes().length === 0) return false;
      return true;
    },
    latestMessage() {
      if (this.events.length > 0) {
        return this.events[0].displayText;
      }
      if (this.currentJobId) {
        return 'Job created. Waiting for realtime updates.';
      }
      return 'Upload and prevalidate an iEPMS export to begin.';
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
      this.updatedAt = state.updatedAt || '';
    },
    applyRealtimeMessage(message) {
      this.currentStatus = message.status || this.currentStatus;
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
