import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobDetailHeader from '../JobDetailHeader.vue';
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
});
