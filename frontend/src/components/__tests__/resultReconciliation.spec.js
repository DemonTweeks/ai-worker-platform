import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobDetailSummary from '../detail/JobDetailSummary.vue';
import JobHistoryCard from '../history/JobHistoryCard.vue';

const reconciledWarningJob = {
  jobId: 'PR-ISSUE88-REVIEW',
  workerType: 'pr-worker',
  workerId: 'mw-pr',
  workerDisplayName: 'MW PR Worker',
  status: 'completed_with_warning',
  prScope: 'TI',
  generationScope: 'site_code',
  requestedSiteCount: 24,
  matchedSiteCount: 24,
  unmatchedSiteCount: 0,
  outputFileCount: 1,
  reviewRequiredCount: 16,
  warningCount: 0,
  generatedSiteCount: 8,
  reviewRequiredSiteCount: 16,
  approvedIgnoredSiteCount: 0,
  duplicateBlockedSiteCount: 0,
  failedSiteCount: 0,
  accountedSiteCount: 24,
  unaccountedSiteCount: 0,
  finalWorkerSummary: 'Task completed with warnings.'
};

const incompleteResultJob = {
  ...reconciledWarningJob,
  jobId: 'PR-ISSUE88-INCOMPLETE',
  status: 'failed',
  reviewRequiredCount: 0,
  reviewRequiredSiteCount: 0,
  accountedSiteCount: 8,
  unaccountedSiteCount: 16,
  error: {
    code: 'RESULT_RECONCILIATION_INCOMPLETE',
    message: 'Worker result reconciliation is incomplete.'
  }
};

describe('result reconciliation rendering', () => {
  it('shows generated/accounted/business-readable missing-result counts in Job Detail', () => {
    const wrapper = mount(JobDetailSummary, {
      propsData: { job: reconciledWarningJob, outputs: [] }
    });

    expect(wrapper.text()).toContain('Generated Sites');
    expect(wrapper.text()).toContain('Accounted Sites');
    expect(wrapper.text()).toContain('Sites Without Confirmed Result');
    expect(wrapper.text()).toContain('8');
    expect(wrapper.text()).toContain('24');
    expect(wrapper.text()).toContain('remaining sites have explicit review');
  });

  it('shows result reconciliation in History without technical unaccounted wording', () => {
    const wrapper = mount(JobHistoryCard, {
      propsData: { job: reconciledWarningJob },
      stubs: {
        RouterLink: { template: '<a><slot /></a>' }
      }
    });

    expect(wrapper.text()).toContain('Generated');
    expect(wrapper.text()).toContain('Accounted');
    expect(wrapper.text()).toContain('Sites Without Confirmed Result');
    expect(wrapper.text()).not.toContain('Unaccounted');
    expect(wrapper.text()).toContain('Result reconciled: 8/24 generated');
  });

  it('presents reconciliation-integrity failure as Incomplete Result', () => {
    const detailWrapper = mount(JobDetailSummary, {
      propsData: { job: incompleteResultJob, outputs: [] }
    });
    const historyWrapper = mount(JobHistoryCard, {
      propsData: { job: incompleteResultJob },
      stubs: {
        RouterLink: { template: '<a><slot /></a>' }
      }
    });

    expect(detailWrapper.text()).toContain('Incomplete Result');
    expect(detailWrapper.text()).toContain('8 of 24 requested sites generated. 16 sites have no confirmed result.');
    expect(detailWrapper.text()).not.toContain('Unaccounted Sites');
    expect(historyWrapper.text()).toContain('Incomplete Result');
    expect(historyWrapper.text()).toContain('8 of 24 requested sites generated. 16 sites have no confirmed result.');
  });

  it('keeps ordinary failures labelled Failed', () => {
    const wrapper = mount(JobDetailSummary, {
      propsData: {
        job: {
          ...reconciledWarningJob,
          status: 'failed',
          generatedSiteCount: null,
          accountedSiteCount: null,
          unaccountedSiteCount: null,
          error: { code: 'WORKER_PROCESS_FAILED', message: 'Worker process failed.' }
        },
        outputs: []
      }
    });

    expect(wrapper.text()).toContain('Failed');
    expect(wrapper.text()).not.toContain('Incomplete Result');
  });
});
