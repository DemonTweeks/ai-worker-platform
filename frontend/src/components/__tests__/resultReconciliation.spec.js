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

describe('result reconciliation rendering', () => {
  it('shows generated/accounted/unaccounted counts in Job Detail', () => {
    const wrapper = mount(JobDetailSummary, {
      propsData: { job: reconciledWarningJob, outputs: [] }
    });

    expect(wrapper.text()).toContain('Generated Sites');
    expect(wrapper.text()).toContain('Accounted Sites');
    expect(wrapper.text()).toContain('Unaccounted Sites');
    expect(wrapper.text()).toContain('8');
    expect(wrapper.text()).toContain('24');
    expect(wrapper.text()).toContain('remaining sites have explicit review');
  });

  it('shows result reconciliation in History without changing PR Auditor logic', () => {
    const wrapper = mount(JobHistoryCard, {
      propsData: { job: reconciledWarningJob },
      stubs: {
        RouterLink: { template: '<a><slot /></a>' }
      }
    });

    expect(wrapper.text()).toContain('Generated');
    expect(wrapper.text()).toContain('Accounted');
    expect(wrapper.text()).toContain('Unaccounted');
    expect(wrapper.text()).toContain('Result reconciled: 8/24 generated');
  });

  it('surfaces unaccounted work as a result-integrity warning', () => {
    const wrapper = mount(JobDetailSummary, {
      propsData: {
        job: {
          ...reconciledWarningJob,
          jobId: 'PR-ISSUE88-INCOMPLETE',
          status: 'failed',
          reviewRequiredCount: 0,
          reviewRequiredSiteCount: 0,
          accountedSiteCount: 8,
          unaccountedSiteCount: 16,
          error: { message: 'Worker result reconciliation is incomplete.' }
        },
        outputs: []
      }
    });

    expect(wrapper.text()).toContain('Result integrity warning: 8/24 requested sites generated and 16 site(s) are unaccounted for.');
  });
});
