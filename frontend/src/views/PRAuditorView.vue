<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="errorMessage"
      :dismissible="Boolean(errorMessage)"
      @dismiss="dismissErrorMessage"
    />

    <section class="workbench-hero" aria-label="PR Auditor workbench">
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
          <div class="workbench-upload-stack">
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
            <div class="cockpit-card upload-card workbench-upload-card audit-period-card">
              <div class="cockpit-card-heading">
                <span>Final PO Period</span>
                <small>Dispatch Date filter</small>
              </div>
              <div class="audit-period-grid">
                <div class="cockpit-field-group">
                  <label class="field-label" for="pr-auditor-year">Year</label>
                  <select id="pr-auditor-year" v-model.number="prAuditorAuditYear" class="cockpit-sites-input" :disabled="workerFormLocked" @change="onAuditPeriodChanged">
                    <option v-for="year in auditYearOptions" :key="year" :value="year">{{ year }}</option>
                  </select>
                </div>
                <div class="cockpit-field-group">
                  <label class="field-label" for="pr-auditor-month">Month</label>
                  <select id="pr-auditor-month" v-model.number="prAuditorAuditMonth" class="cockpit-sites-input" :disabled="workerFormLocked" @change="onAuditPeriodChanged">
                    <option v-for="month in auditMonthOptions" :key="month.value" :value="month.value">{{ month.label }}</option>
                  </select>
                </div>
              </div>
              <p class="field-hint">Only Final PO rows with a Dispatch Date in this period will be audited.</p>
            </div>
            <UploadPanel
              class="cockpit-card upload-card workbench-upload-card"
              title="EPMS Upload"
              input-id="pr-auditor-epms-file"
              input-label="EPMS workbook"
              input-hint="Upload EPMS site data. create-pr-cd will generate the TSS and TI entitlement used by the audit."
              validate-label="Validate EPMS"
              accept=".xlsx,.xls,.xlsm"
              :result="prAuditorEpmsPrevalidation"
              :loading="prAuditorEpmsPrevalidating"
              :disable-action="workerFormLocked"
              @file-selected="onPrAuditorFileSelected('epms', $event)"
              @prevalidate="prevalidatePrAuditorUpload('epms', $event)"
            />
          </div>

          <section class="panel cockpit-card workbench-config-card">
            <div class="cockpit-card-heading">
              <span>Launch Configuration</span>
              <small>{{ activeModeLabel }}</small>
            </div>

            <div class="workbench-config-grid">
              <div class="cockpit-empty-card">
                <strong>Controlled two-stage run</strong>
                <ol class="audit-flow-list">
                  <li>
                    <span>01</span>
                    <div>
                      <strong>Create entitlement</strong>
                      <p>create-pr-cd reads EPMS and generates mandatory TSS and TI ECC lines.</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>Audit Final PO</strong>
                      <p>tx-pr-auditor compares Final PO only with the generated ECC entitlement.</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>Deliver evidence</strong>
                      <p>Download the audit workbook and summary. Uploaded source files remain unchanged.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>

            <div class="cockpit-empty-card">
              One job runs both engines in order. EPMS is never passed into tx-pr-auditor.
              Audit findings require business review.
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
import { createJob, getErrorMessage, prevalidateUpload } from '../api/jobApi';
import {
  buildWorkerIdempotencyStorageKey,
  createIdempotencyKey,
  workerRuntimeMixin
} from './shared/workerRuntime';

export default {
  name: 'PRAuditorView',
  components: {
    ErrorBanner,
    UploadPanel,
    LoadingButton
  },
  mixins: [workerRuntimeMixin],
  data() {
    const now = new Date();
    return {
      prAuditorFinalPoFile: null,
      prAuditorEpmsFile: null,
      prAuditorFinalPoPrevalidation: null,
      prAuditorEpmsPrevalidation: null,
      prAuditorFinalPoPrevalidating: false,
      prAuditorEpmsPrevalidating: false,
      prAuditorPendingIdempotencyKey: '',
      prAuditorAuditYear: now.getFullYear(),
      prAuditorAuditMonth: now.getMonth() + 1
    };
  },
  computed: {
    auditYearOptions() {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: currentYear - 1998 }, (_, index) => currentYear + 1 - index);
    },
    auditMonthOptions() {
      return Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index, 1))
      }));
    },
    heroTitle() {
      return 'Review PO submissions with the dedicated PR Auditor worker.';
    },
    heroSubtitle() {
      return 'Upload Final PO and EPMS once. The worker creates ECC entitlement, audits PO claims, and preserves evidence in one controlled run.';
    },
    activeWorkerLabel() {
      return 'PR Auditor';
    },
    activeModeLabel() {
      return 'Audit Run';
    },
    activeWorkbenchTitle() {
      return 'PR Auditor';
    },
    activeWorkbenchAriaLabel() {
      return 'PR Auditor workflow';
    },
    primaryActionLabel() {
      return 'Run Audit';
    },
    secondaryActionLabel() {
      return 'Run Another Audit';
    },
    readyActionText() {
      return 'Ready to run audit';
    },
    idempotencyNotice() {
      return 'This Run Audit action will reuse the current idempotency key until you change inputs or choose Run Another Audit.';
    },
    activePendingIdempotencyKey() {
      return this.prAuditorPendingIdempotencyKey;
    },
    canCreateJob() {
      if (this.creating) return false;
      if (!this.prAuditorFinalPoFile || !this.prAuditorEpmsFile) return false;
      if (!this.prAuditorFinalPoPrevalidation || !this.prAuditorFinalPoPrevalidation.passed) return false;
      if (!this.prAuditorEpmsPrevalidation || !this.prAuditorEpmsPrevalidation.passed) return false;
      return true;
    },
    createDisabledReason() {
      if (!this.prAuditorFinalPoFile || !this.prAuditorEpmsFile) {
        return 'Upload Final PO and EPMS workbooks to start.';
      }
      if (this.prAuditorFinalPoPrevalidating || this.prAuditorEpmsPrevalidating) {
        return 'PR Auditor upload validation is in progress.';
      }
      if (!this.prAuditorFinalPoPrevalidation || !this.prAuditorEpmsPrevalidation) {
        return 'Validate Final PO and EPMS workbooks before running the audit.';
      }
      if (!this.prAuditorFinalPoPrevalidation.passed || !this.prAuditorEpmsPrevalidation.passed) {
        return 'Validation failed; resolve the PR Auditor upload issues before running the audit.';
      }
      if (this.creating) return 'Submitting audit request.';
      return '';
    },
    consoleItems() {
      const items = [
        {
          id: 'session-ready',
          label: 'Workbench',
          title: 'Ready for PR Auditor upload',
          body: 'Upload Final PO and EPMS workbooks, validate each one, run the audit, then track progress and outputs here.',
          tone: 'info',
          time: ''
        }
      ];

      if (this.prAuditorFinalPoFile) {
        items.push({
          id: 'final-po-file-selected',
          label: 'Upload',
          title: 'Final PO workbook selected',
          body: this.prAuditorFinalPoFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.prAuditorEpmsFile) {
        items.push({
          id: 'epms-file-selected',
          label: 'Upload',
          title: 'EPMS workbook selected',
          body: this.prAuditorEpmsFile.name,
          tone: 'info',
          time: ''
        });
      }

      if (this.prAuditorFinalPoPrevalidation) {
        items.push({
          id: 'final-po-validation-state',
          label: 'Validate',
          title: this.prAuditorFinalPoPrevalidation.passed ? 'Final PO validation passed' : 'Final PO validation failed',
          body: this.prAuditorFinalPoPrevalidation.workerExplanation || (this.prAuditorFinalPoPrevalidation.passed ? 'The Final PO workbook is ready for audit.' : 'Review the Final PO validation checklist and correct the workbook.'),
          tone: this.prAuditorFinalPoPrevalidation.passed ? 'success' : 'danger',
          time: ''
        });
      }

      if (this.prAuditorEpmsPrevalidation) {
        items.push({
          id: 'epms-validation-state',
          label: 'Validate',
          title: this.prAuditorEpmsPrevalidation.passed ? 'EPMS validation passed' : 'EPMS validation failed',
          body: this.prAuditorEpmsPrevalidation.workerExplanation || (this.prAuditorEpmsPrevalidation.passed ? 'The EPMS workbook is ready for audit.' : 'Review the EPMS validation checklist and correct the workbook.'),
          tone: this.prAuditorEpmsPrevalidation.passed ? 'success' : 'danger',
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
    }
  },
  methods: {
    onAuditPeriodChanged() {
      this.resetActivePendingIdempotencyKey();
    },
    initializePendingIdempotencyKeys() {
      this.prAuditorPendingIdempotencyKey = sessionStorage.getItem(buildWorkerIdempotencyStorageKey('pr-auditor')) || '';
    },
    setPendingIdempotencyKey(idempotencyKey) {
      sessionStorage.setItem(buildWorkerIdempotencyStorageKey('pr-auditor'), idempotencyKey);
      this.prAuditorPendingIdempotencyKey = idempotencyKey;
    },
    ensurePendingIdempotencyKey() {
      if (this.prAuditorPendingIdempotencyKey) {
        return this.prAuditorPendingIdempotencyKey;
      }

      const created = createIdempotencyKey('pr-auditor');
      this.setPendingIdempotencyKey(created);
      return created;
    },
    resetActivePendingIdempotencyKey() {
      sessionStorage.removeItem(buildWorkerIdempotencyStorageKey('pr-auditor'));
      this.prAuditorPendingIdempotencyKey = '';
    },
    onPrAuditorFileSelected(kind, file) {
      if (kind === 'finalPo') {
        this.prAuditorFinalPoFile = file;
        this.prAuditorFinalPoPrevalidation = null;
      } else {
        this.prAuditorEpmsFile = file;
        this.prAuditorEpmsPrevalidation = null;
      }

      this.resetActivePendingIdempotencyKey();
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
    async prevalidatePrAuditorUpload(kind, file) {
      if (!file) {
        const label = kind === 'finalPo' ? 'Final PO' : 'EPMS';
        this.errorMessage = `Select a ${label} file first.`;
        return;
      }

      if (kind === 'finalPo') {
        this.prAuditorFinalPoPrevalidating = true;
      } else {
        this.prAuditorEpmsPrevalidating = true;
      }
      this.errorMessage = '';

      const uploadKind = kind === 'finalPo'
        ? 'pr-auditor-final-po'
        : 'pr-auditor-epms';

      try {
        const result = await prevalidateUpload(file, uploadKind, {
          workerId: 'pr-auditor',
          browserTabSessionId: this.browserTabSessionId
        });

        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidation = result;
        } else {
          this.prAuditorEpmsPrevalidation = result;
        }
      } catch (error) {
        const fallback = this.getSafePrevalidationPayload(error);
        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidation = fallback;
        } else {
          this.prAuditorEpmsPrevalidation = fallback;
        }
        if (!this.isExpectedPrevalidationFailure(error)) {
          this.errorMessage = getErrorMessage(error);
        }
      } finally {
        if (kind === 'finalPo') {
          this.prAuditorFinalPoPrevalidating = false;
        } else {
          this.prAuditorEpmsPrevalidating = false;
        }
      }
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
        const result = await createJob({
          workerId: 'pr-auditor',
          browserTabSessionId: this.browserTabSessionId,
          idempotencyKey: this.ensurePendingIdempotencyKey(),
          finalPoPrevalidatedFileId: this.prAuditorFinalPoPrevalidation.prevalidatedFileId,
          epmsPrevalidatedFileId: this.prAuditorEpmsPrevalidation.prevalidatedFileId,
          auditYear: this.prAuditorAuditYear,
          auditMonth: this.prAuditorAuditMonth
        });
        this.upsertActiveSessionJob(result.job);
        this.rememberSelectedJobId(result.job.jobId);
        this.currentPrScope = result.job.prScope || 'AUDIT';
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
