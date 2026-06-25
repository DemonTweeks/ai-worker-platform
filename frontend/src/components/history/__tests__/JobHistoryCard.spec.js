import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobHistoryCard from '../JobHistoryCard.vue';

describe('JobHistoryCard.vue Component', () => {
  it('renders standard worker summary for successful jobs', () => {
    const job = {
      jobId: 'PR-SUCCESS-001',
      status: 'completed',
      workerType: 'pr-worker',
      finalWorkerSummary: 'Job completed successfully with 15 ECC matches.',
      createdAt: new Date().toISOString()
    };

    const wrapper = mount(JobHistoryCard, {
      propsData: { job },
      stubs: {
        routerLink: true,
        JobStatusBadge: true,
        JobScopeBadge: true
      }
    });

    expect(wrapper.text()).toContain('Job completed successfully with 15 ECC matches.');
  });

  it('renders concise failureSummary for failed jobs and does not render raw logs', () => {
    const job = {
      jobId: 'PR-FAILED-002',
      status: 'failed',
      workerType: 'pr-worker',
      finalWorkerSummary: 'Execution crashed at step 4.',
      failureSummary: 'Dependency missing: pandas',
      createdAt: new Date().toISOString()
    };

    const wrapper = mount(JobHistoryCard, {
      propsData: { job },
      stubs: {
        routerLink: true,
        JobStatusBadge: true,
        JobScopeBadge: true
      }
    });

    const text = wrapper.text();
    expect(text).toContain('Dependency missing: pandas');
    expect(text).not.toContain('Execution crashed at step 4.');
  });
});
