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
});
