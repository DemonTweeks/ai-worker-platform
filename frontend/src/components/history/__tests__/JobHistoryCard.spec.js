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

  it('renders worker-aware metadata for ran jobs', () => {
    const job = {
      jobId: 'PR-RAN-003',
      status: 'completed',
      workerType: 'pr-worker',
      workerId: 'ran-pr',
      workerDisplayName: 'RAN PR Worker',
      runMode: 'general-item',
      selectedProject: 'Project Thanos',
      generationScope: 'all_sites',
      outputFileCount: 1,
      finalWorkerSummary: 'RAN general-item job completed.',
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
    expect(text).toContain('RAN PR Worker');
    expect(text).toContain('general-item');
    expect(text).toContain('Project Thanos');
  });

  it('labels cancelled partial packages as partial delivery', () => {
    const job = {
      jobId: 'PR-CANCELLED-PARTIAL-004',
      status: 'cancelled_with_partial_result',
      workerType: 'pr-worker',
      outputFileCount: 1,
      finalWorkerSummary: 'Task cancelled after partial output was preserved.',
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
    expect(text).toContain('Download Partial ZIP');
    expect(text).toContain('not a completed delivery');
  });

  it('renders PR Auditor summary counts and audit report download action', () => {
    const job = {
      jobId: 'PR-AUDIT-005',
      status: 'completed',
      workerType: 'pr-worker',
      workerId: 'pr-auditor',
      workerDisplayName: 'PR Auditor',
      outputFileCount: 1,
      warningCount: 2,
      reviewRequiredCount: 5,
      auditSummary: {
        normalCount: 4,
        invalidPoCount: 1,
        wrongPoCount: 2,
        duplicatePoCount: 3,
        reviewRequiredCount: 5,
        warnings: ['warning-a', 'warning-b']
      },
      outputs: [
        {
          id: 'audit-result-1',
          fileType: 'pr_audit_result_xlsx',
          available: true
        }
      ],
      finalWorkerSummary: 'Audit report generated.',
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
    expect(text).toContain('PR Auditor');
    expect(text).toContain('Audit Result');
    expect(text).toContain('Normal: 4');
    expect(text).toContain('Invalid PO: 1');
    expect(text).toContain('Wrong PO: 2');
    expect(text).toContain('Duplicate PO: 3');
    expect(text).toContain('Review Required: 5');
    expect(text).toContain('Warnings: 2');
    expect(text).toContain('Download Audit Report');
  });

  it('does not claim an audit report exists for a failed PR Auditor job with zero outputs', () => {
    const wrapper = mount(JobHistoryCard, {
      propsData: {
        job: {
          jobId: 'PR-AUDIT-FAILED-006',
          status: 'failed',
          workerId: 'pr-auditor',
          outputFileCount: 0,
          outputs: [],
          finalWorkerSummary: 'Audit report generated.',
          createdAt: new Date().toISOString()
        }
      },
      stubs: { routerLink: true, JobStatusBadge: true, JobScopeBadge: true }
    });

    expect(wrapper.text()).toContain('No audit report was generated.');
    expect(wrapper.text()).not.toContain('Audit report generated.');
    expect(wrapper.text()).not.toContain('Download Audit Report');
  });
});
