import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JobHistoryView from '../JobHistoryView.vue';

const { listJobs } = vi.hoisted(() => ({
  listJobs: vi.fn()
}));

vi.mock('../../api/jobApi', () => ({
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  listJobs
}));

describe('JobHistoryView worker-aware filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listJobs.mockResolvedValue({
      items: [],
      total: 0
    });
  });

  it('includes workerId in the list query when the worker filter is selected', async () => {
    const wrapper = mount(JobHistoryView, {
      stubs: {
        routerLink: true,
        ErrorBanner: true,
        JobHistoryCard: true,
        JobHistoryFilters: true
      }
    });

    await wrapper.setData({
      filters: {
        search: '',
        status: '',
        workerId: 'ran-pr',
        prScope: '',
        dateFrom: '',
        dateTo: '',
        sortBy: 'createdAt_desc'
      }
    });

    await wrapper.vm.loadJobs();

    expect(listJobs).toHaveBeenLastCalledWith(expect.objectContaining({
      workerId: 'ran-pr',
      workerType: 'pr-worker'
    }));
  });

  it('offers PR Auditor in the worker filter options', () => {
    const wrapper = mount(JobHistoryView, {
      stubs: {
        routerLink: true,
        ErrorBanner: true,
        JobHistoryCard: true,
        JobHistoryFilters: false
      }
    });

    expect(wrapper.text()).toContain('PR Auditor');
  });
});
