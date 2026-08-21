import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobHistoryTable from '../JobHistoryTable.vue';

const mountTable = (jobs, startIndex = 0) => mount(JobHistoryTable, {
  propsData: { jobs, startIndex },
  stubs: {
    routerLink: true,
    JobStatusBadge: true
  }
});

describe('JobHistoryTable', () => {
  it('renders page-aware row numbers and compact multi-site labels', () => {
    const wrapper = mountTable([{
      jobId: 'PR-001',
      workerDisplayName: 'RAN PR Worker',
      status: 'completed',
      matchedSiteCodes: ['SITE-001', 'SITE-002', 'SITE-001'],
      createdAt: '2026-08-20T12:00:00.000Z'
    }], 20);

    expect(wrapper.find('td.history-index-column').text()).toBe('21');
    expect(wrapper.find('td.history-site-column').text()).toBe('SITE-001 +1');
    expect(wrapper.find('.history-site-code').attributes('title')).toBe('SITE-001, SITE-002');
  });

  it('keeps number and site-code cells marked as sticky columns', () => {
    const wrapper = mountTable([{
      jobId: 'PR-002',
      status: 'running',
      generationScope: 'all_sites',
      createdAt: '2026-08-20T12:00:00.000Z'
    }]);

    expect(wrapper.find('th.history-index-column').exists()).toBe(true);
    expect(wrapper.find('th.history-site-column').exists()).toBe(true);
    expect(wrapper.find('td.history-index-column').exists()).toBe(true);
    expect(wrapper.find('td.history-site-column').text()).toBe('All sites');
  });

  it('preserves detail and downloadable-output actions', () => {
    const wrapper = mountTable([{
      jobId: 'PR-003',
      status: 'completed',
      outputs: [{
        id: 'result-zip',
        fileType: 'zip_package',
        fileName: 'result.zip',
        available: true
      }],
      createdAt: '2026-08-20T12:00:00.000Z'
    }]);

    expect(wrapper.text()).toContain('View');
    expect(wrapper.text()).toContain('Download');
    expect(wrapper.find('a.secondary-link').attributes('href')).toContain('/download/result-zip');
  });
});
