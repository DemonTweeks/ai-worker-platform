import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FinalSummary from '../FinalSummary.vue';

describe('FinalSummary PR Auditor report wording', () => {
  it('overrides stale report wording when no tracked report is downloadable', () => {
    const wrapper = mount(FinalSummary, {
      propsData: {
        detail: {
          job: {
            jobId: 'PR-AUDIT-FAILED-001',
            workerId: 'pr-auditor',
            status: 'failed',
            outputFileCount: 0,
            finalWorkerSummary: 'Audit report generated. Detailed findings are available in the workbook.'
          },
          outputs: []
        }
      }
    });

    expect(wrapper.text()).toContain('No audit report was generated.');
    expect(wrapper.text()).not.toContain('Audit report generated.');
    expect(wrapper.text()).not.toContain('Detailed findings');
  });

  it('shows report wording for a completed job with a tracked downloadable workbook', () => {
    const wrapper = mount(FinalSummary, {
      propsData: {
        detail: {
          job: {
            jobId: 'PR-AUDIT-COMPLETE-002',
            workerId: 'pr-auditor',
            status: 'completed',
            outputFileCount: 1
          },
          outputs: [{ id: 'report-1', fileType: 'pr_audit_result_xlsx', available: true }]
        }
      }
    });

    expect(wrapper.text()).toContain('Audit report generated.');
    expect(wrapper.text()).toContain('workbook download');
  });
});
