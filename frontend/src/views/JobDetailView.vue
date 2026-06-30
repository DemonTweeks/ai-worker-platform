<template>
  <div class="portal-shell detail-page">
    <ErrorBanner :message="errorMessage" />

    <section class="hero-band">
      <div class="hero-action-row">
        <router-link class="secondary-link" to="/history">Back to History</router-link>
        <span v-if="detail && detail.job" class="muted">Job ID: {{ detail.job.jobId }}</span>
        <span v-else class="muted">Loading job identifier…</span>
      </div>
      <router-link class="download-button" to="/">Run New Job</router-link>
    </section>

    <div v-if="loading" class="panel empty-state">
      <div class="skeleton-row">Loading job detail…</div>
    </div>
    <div v-else-if="detail && detail.job" class="detail-layout">
      <JobDetailHeader :job="detail.job" />
      <FinalSummary :detail="detail" />
      <JobDetailSummary :job="detail.job" />
      <FailureDiagnosis :job="detail.job" />
      <div class="detail-grid-two">
        <section class="panel">
          <h2>Execution Timeline</h2>
          <JobDetailTimeline :job="detail.job" :live-events="events" />
        </section>
        <section class="panel">
          <h2>Files and Outputs</h2>
          <JobDetailFiles :job-id="detail.job.jobId" :outputs="detail.outputs || []" :status="detail.job.status" />
        </section>
      </div>
      <JobDetailWarnings :warnings="detail.warnings || []" />
      <JobDetailReviewRequired :items="detail.reviewRequiredItems || []" />
      <JobDetailAssetVersions :asset-versions="detail.assetVersions || {}" />
      <ReAskPanel
        :job-id="detail.job.jobId"
        :loading="asking"
        :answer="reAskAnswer"
        @ask="askQuestion"
      />
      <section v-if="subscribedToRealtime" class="panel">
        <h2>Realtime Status</h2>
        <p class="worker-message">{{ latestMessage }}</p>
        <small>Connection: {{ connectionStatus }}</small>
      </section>
    </div>
    <div v-else class="panel empty-state">Job detail is unavailable.</div>
  </div>
</template>

<script>
import ErrorBanner from '../components/ErrorBanner.vue';
import FinalSummary from '../components/FinalSummary.vue';
import ReAskPanel from '../components/ReAskPanel.vue';
import FailureDiagnosis from '../components/detail/FailureDiagnosis.vue';
import JobDetailAssetVersions from '../components/detail/JobDetailAssetVersions.vue';
import JobDetailFiles from '../components/detail/JobDetailFiles.vue';
import JobDetailHeader from '../components/detail/JobDetailHeader.vue';
import JobDetailReviewRequired from '../components/detail/JobDetailReviewRequired.vue';
import JobDetailSummary from '../components/detail/JobDetailSummary.vue';
import JobDetailTimeline from '../components/detail/JobDetailTimeline.vue';
import JobDetailWarnings from '../components/detail/JobDetailWarnings.vue';
import { askJob } from '../api/reAskApi';
import { getErrorMessage, getJobDetail } from '../api/jobApi';
import JobWebSocketClient from '../services/websocketClient';
import { displayMessage, isTerminalStatus } from '../utils/statusUtils';
import { isRunningStatus } from '../utils/jobStatusUtils';

export default {
  name: 'JobDetailView',
  components: {
    ErrorBanner,
    FinalSummary,
    FailureDiagnosis,
    JobDetailAssetVersions,
    JobDetailFiles,
    JobDetailHeader,
    JobDetailReviewRequired,
    JobDetailSummary,
    JobDetailTimeline,
    JobDetailWarnings,
    ReAskPanel
  },
  props: {
    jobId: { type: String, required: true }
  },
  data() {
    return {
      detail: null,
      loading: false,
      asking: false,
      errorMessage: '',
      reAskAnswer: null,
      events: [],
      connectionStatus: 'disconnected',
      wsClient: null,
      subscribedToRealtime: false
    };
  },
  computed: {
    latestMessage() {
      if (this.events.length > 0) return this.events[0].displayText;
      return 'Watching live job state.';
    }
  },
  mounted() {
    this.loadDetail();
  },
  beforeDestroy() {
    if (this.wsClient) {
      this.wsClient.close();
    }
  },
  methods: {
    async loadDetail() {
      this.loading = true;
      this.errorMessage = '';
      try {
        this.detail = await getJobDetail(this.jobId);
        this.maybeSubscribeToRealtime();
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    maybeSubscribeToRealtime() {
      if (!this.detail || !this.detail.job || !isRunningStatus(this.detail.job.status)) {
        return;
      }

      this.subscribedToRealtime = true;
      this.wsClient = new JobWebSocketClient({
        onMessage: this.handleWebSocketMessage,
        onStatus: (status) => {
          this.connectionStatus = status;
        }
      });
      this.wsClient.connect(this.detail.job.jobId);
    },
    handleWebSocketMessage(message) {
      if (message.type === 'ERROR') {
        this.errorMessage = message.message || 'Realtime connection error.';
        return;
      }

      if (message.type === 'SUBSCRIBED' && message.state && this.detail && this.detail.job) {
        this.detail.job.status = message.state.status || this.detail.job.status;
        return;
      }

      if (message.type === 'JOB_EVENT' || message.type === 'JOB_HEARTBEAT') {
        if (this.detail && this.detail.job) {
          this.detail.job.status = message.status || this.detail.job.status;
        }
        this.events = [{
          ...message,
          displayText: displayMessage(message)
        }, ...this.events].slice(0, 50);

        if (isTerminalStatus(message.status)) {
          this.loadDetail();
        }
      }
    },
    async askQuestion(question) {
      if (!this.detail || !this.detail.job || !question.trim()) return;
      this.asking = true;
      this.errorMessage = '';
      try {
        this.reAskAnswer = await askJob(this.detail.job.jobId, question);
      } catch (error) {
        this.errorMessage = getErrorMessage(error);
      } finally {
        this.asking = false;
      }
    }
  }
};
</script>
