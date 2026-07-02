import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobDetailHeader from '../JobDetailHeader.vue';
import JobDetailFiles from '../JobDetailFiles.vue';
import JobDetailSummary from '../JobDetailSummary.vue';

describe('RAN detail metadata rendering', () => {
  it('shows worker identity in the detail header for ran jobs', () => {
    const wrapper = mount(JobDetailHeader, {
      propsData: {
        job: {
          jobId: 'PR-RAN-DETAIL-001',
          status: 'completed',
          workerId: 'ran-pr',
          workerDisplayName: 'RAN PR Worker',
          prScope: null
        }
      },
      stubs: {
        JobStatusBadge: true,
        JobScopeBadge: true
      }
    });

    expect(wrapper.text()).toContain('RAN PR Worker');
    expect(wrapper.text()).toContain('ran-pr');
  });

  it('shows run mode, selected project, and engine audit metadata for ran jobs', () => {
    const wrapper = mount(JobDetailSummary, {
      propsData: {
        job: {
          jobId: 'PR-RAN-DETAIL-002',
          status: 'completed',
          workerType: 'pr-worker',
          workerId: 'ran-pr',
          workerDisplayName: 'RAN PR Worker',
          engineVersion: 'v1.0.0',
          engineCommit: '239910e2816153339a94881597bbb95355059741',
          runMode: 'general-item',
          selectedProject: 'Project Thanos',
          generationScope: 'all_sites',
          createdAt: new Date().toISOString()
        }
      }
    });

    const text = wrapper.text();
    expect(text).toContain('RAN PR Worker');
    expect(text).toContain('general-item');
    expect(text).toContain('Project Thanos');
    expect(text).toContain('v1.0.0');
    expect(text).toContain('239910e2816153339a94881597bbb95355059741');
  });

  it('shows PR Auditor-specific summary counts and audit report downloads', () => {
    const summaryWrapper = mount(JobDetailSummary, {
      propsData: {
        job: {
          jobId: 'PR-AUDIT-DETAIL-003',
          status: 'completed',
          workerType: 'pr-worker',
          workerId: 'pr-auditor',
          workerDisplayName: 'PR Auditor',
          engineVersion: 'pending-safe-pin',
          engineCommit: 'unapproved',
          auditSummary: {
            normalCount: 4,
            invalidPoCount: 1,
            wrongPoCount: 2,
            duplicatePoCount: 3,
            reviewRequiredCount: 5,
            warnings: ['warning-a', 'warning-b']
          },
          outputFileCount: 1,
          warningCount: 2,
          reviewRequiredCount: 5,
          createdAt: new Date().toISOString()
        }
      }
    });

    const filesWrapper = mount(JobDetailFiles, {
      propsData: {
        jobId: 'PR-AUDIT-DETAIL-003',
        workerId: 'pr-auditor',
        outputs: [
          {
            id: 'audit-result-1',
            fileType: 'pr_audit_result_xlsx',
            fileName: 'PR_Audit_Result.xlsx',
            fileSize: 1024,
            available: true,
            exists: true
          },
          {
            id: 'audit-summary-1',
            fileType: 'pr_audit_summary_json',
            fileName: 'pr_audit_summary.json',
            fileSize: 256,
            available: true,
            exists: true
          }
        ],
        status: 'completed'
      }
    });

    const summaryText = summaryWrapper.text();
    expect(summaryText).toContain('PR Auditor');
    expect(summaryText).toContain('Normal');
    expect(summaryText).toContain('4');
    expect(summaryText).toContain('Invalid PO');
    expect(summaryText).toContain('Wrong PO');
    expect(summaryText).toContain('Duplicate PO');
    expect(summaryText).toContain('Review Required');
    expect(summaryText).toContain('Warnings');
    expect(summaryText).not.toContain('Run Mode');
    expect(summaryText).not.toContain('Project');
    expect(summaryText).not.toContain('Generation');

    const filesText = filesWrapper.text();
    expect(filesText).toContain('Audit Report');
    expect(filesText).toContain('Audit Summary JSON');
    expect(filesText).toContain('Download Audit Report');
  });
});
