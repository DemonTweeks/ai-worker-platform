import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PRCreatorView from '../PRCreatorView.vue';

vi.mock('../../api/jobApi', () => ({
  cancelJob: vi.fn(),
  createJob: vi.fn(),
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getFileDownloadUrl: vi.fn((jobId, fileId) => `/jobs/${jobId}/download/${fileId}`),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  getJobDetail: vi.fn(),
  getZipDownloadUrl: vi.fn(() => '/download.zip'),
  listJobs: vi.fn(async () => ({ items: [], total: 0 })),
  listRanProjects: vi.fn(async () => ({ projects: [] })),
  prevalidateUpload: vi.fn()
}));

vi.mock('../../api/reAskApi', () => ({
  askJob: vi.fn()
}));

vi.mock('../../services/websocketClient', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn()
  }))
}));

const mountView = () => mount(PRCreatorView, {
  stubs: {
    UploadPanel: {
      props: ['title', 'inputLabel', 'validateLabel', 'inputHint'],
      template: `
        <div class="upload-panel-stub">
          <span class="upload-panel-title">{{ title }}</span>
          <span class="upload-panel-label">{{ inputLabel }}</span>
          <span class="upload-panel-validate">{{ validateLabel }}</span>
          <span class="upload-panel-hint">{{ inputHint }}</span>
        </div>
      `
    },
    LoadingButton: {
      props: ['label'],
      template: '<button type="button" class="loading-button-stub">{{ label }}</button>'
    }
  }
});

describe('PRCreatorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps MW PR and RAN PR as internal PR Creator modes and excludes PR Auditor upload controls', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('PR Creator');
    expect(wrapper.text()).toContain('MW PR');
    expect(wrapper.text()).toContain('RAN PR');
    expect(wrapper.text()).toContain('Site mode');
    expect(wrapper.text()).toContain('Task Type');
    expect(wrapper.text()).not.toContain('Final PO workbook');
    expect(wrapper.text()).not.toContain('PR Model workbook');
    expect(wrapper.text()).not.toContain('Run Audit');
  });

  it('owns the PR Creator page instead of delegating to HomeView', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: 'HomeView' }).exists()).toBe(false);
  });

  it('selects an active job and scrolls to its live output console', async () => {
    const wrapper = mountView();
    await wrapper.vm.restoreActiveJobs();
    await wrapper.setData({
      activeSessionJobs: [{
        jobId: 'PR-20260720-001',
        workerId: 'mw-pr',
        workerDisplayName: 'MW PR Worker',
        status: 'generating',
        createdAt: '2026-07-20T02:14:55.000Z'
      }]
    });
    const selectActiveJob = vi.spyOn(wrapper.vm, 'selectActiveJob').mockResolvedValue();
    const scrollIntoView = vi.fn();
    wrapper.vm.$refs.workerConsole.scrollIntoView = scrollIntoView;
    const viewButton = wrapper.findAll('button').wrappers.find((button) => button.text() === 'View');

    await viewButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(selectActiveJob).toHaveBeenCalledWith('PR-20260720-001');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});
