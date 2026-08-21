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

const buildFilters = (overrides = {}) => ({
  search: '',
  status: '',
  workerId: '',
  prScope: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt_desc',
  ...overrides
});

const mountView = () => mount(JobHistoryView, {
  stubs: {
    routerLink: true,
    ErrorBanner: true,
    JobHistoryTable: true,
    JobHistoryFilters: true
  }
});

describe('JobHistoryView worker-aware filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listJobs.mockResolvedValue({
      items: [],
      total: 0
    });
  });

  it('includes workerId in the list query when the worker filter is selected', async () => {
    const wrapper = mountView();

    await wrapper.setData({
      filters: buildFilters({ workerId: 'ran-pr' })
    });

    await wrapper.vm.loadJobs();

    expect(listJobs).toHaveBeenLastCalledWith(expect.objectContaining({
      workerId: 'ran-pr'
    }));
    expect(listJobs.mock.calls.at(-1)[0]).not.toHaveProperty('workerType');
  });

  it('loads legacy and generic jobs together by default', async () => {
    mountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const query = listJobs.mock.calls[0][0];
    expect(query).toEqual({ page: 1, limit: 20 });
  });

  it('omits stale PR Scope from PR Auditor list queries', async () => {
    const wrapper = mountView();

    await wrapper.setData({
      filters: buildFilters({
        workerId: 'pr-auditor',
        prScope: 'TSS'
      })
    });

    await wrapper.vm.loadJobs();

    const query = listJobs.mock.calls.at(-1)[0];
    expect(query.workerId).toBe('pr-auditor');
    expect(query).not.toHaveProperty('prScope');
  });

  it('retains valid PR Scope filtering for PR Creator workers', async () => {
    const wrapper = mountView();

    await wrapper.setData({
      filters: buildFilters({
        workerId: 'mw-pr',
        prScope: 'TI'
      })
    });

    await wrapper.vm.loadJobs();

    expect(listJobs).toHaveBeenLastCalledWith(expect.objectContaining({
      workerId: 'mw-pr',
      prScope: 'TI'
    }));
  });

  it('offers PR Auditor in the worker filter options', () => {
    const wrapper = mount(JobHistoryView, {
      stubs: {
        routerLink: true,
        ErrorBanner: true,
        JobHistoryTable: true,
        JobHistoryFilters: false
      }
    });

    expect(wrapper.text()).toContain('PR Auditor');
    expect(wrapper.find('option[value="tx-pr-auditor"]').exists()).toBe(true);
  });
});
