import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PRAuditorView from '../PRAuditorView.vue';

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

const mountView = () => mount(PRAuditorView, {
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

describe('PRAuditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the PR Auditor launch controls and required notice copy', async () => {
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('PR Auditor');
    expect(wrapper.text()).toContain('Final PO workbook');
    expect(wrapper.text()).toContain('EPMS workbook');
    expect(wrapper.text()).toContain('PR Model workbook');
    expect(wrapper.text()).toContain('Run Audit');
    expect(wrapper.text()).toContain('PR Auditor reviews submitted PO data against configured audit rules.');
    expect(wrapper.text()).toContain('It does not create or modify PR or ECC records.');
    expect(wrapper.text()).toContain('Audit findings require business review.');
    expect(wrapper.text()).not.toContain('MW PR Worker');
    expect(wrapper.text()).not.toContain('RAN PR Worker');
    expect(wrapper.text()).not.toContain('Site mode');
    expect(wrapper.text()).not.toContain('Task Type');
    expect(wrapper.text()).not.toContain('Standard PR');
    expect(wrapper.text()).not.toContain('General Item');
  });
});
