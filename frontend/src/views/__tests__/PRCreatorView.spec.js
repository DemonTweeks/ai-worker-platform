import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PRCreatorView from '../PRCreatorView.vue';
import { getPrevalidatedUpload, releasePrevalidatedUpload } from '../../api/jobApi';

vi.mock('../../api/jobApi', () => ({
  cancelJob: vi.fn(),
  createJob: vi.fn(),
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getFileDownloadUrl: vi.fn((jobId, fileId) => `/jobs/${jobId}/download/${fileId}`),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  getJobDetail: vi.fn(),
  getPrevalidatedUpload: vi.fn(),
  getZipDownloadUrl: vi.fn(() => '/download.zip'),
  listJobs: vi.fn(async () => ({ items: [], total: 0 })),
  listRanProjects: vi.fn(async () => ({ projects: [] })),
  prevalidateUpload: vi.fn(),
  releasePrevalidatedUpload: vi.fn()
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
    getPrevalidatedUpload.mockReset();
    releasePrevalidatedUpload.mockReset();
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

  it('restores a reusable validated MW upload after refresh', async () => {
    getPrevalidatedUpload.mockResolvedValue({
      prevalidatedFileId: 'preval-reusable-1',
      uploadKind: 'mw-export',
      originalFileName: 'site-export.xlsx',
      passed: true,
      reusable: true,
      retentionUntil: '2027-01-16T00:00:00.000Z',
      checklist: []
    });
    const wrapper = mountView();
    sessionStorage.setItem('awp.prCreator.reusableMwUpload', JSON.stringify({
      prevalidatedFileId: 'preval-reusable-1'
    }));

    await wrapper.vm.restoreReusableMwUpload();

    expect(getPrevalidatedUpload).toHaveBeenCalledWith('preval-reusable-1', wrapper.vm.browserTabSessionId);
    expect(wrapper.vm.prevalidation.originalFileName).toBe('site-export.xlsx');
    expect(wrapper.vm.hasReusableMwUpload).toBe(true);
    expect(wrapper.vm.selectedFile).toBe(null);
  });

  it('restores reusable RAN BOM and EPMS uploads with the selected run mode', async () => {
    getPrevalidatedUpload.mockImplementation(async (prevalidatedFileId) => ({
      prevalidatedFileId,
      uploadKind: prevalidatedFileId === 'ran-bom-1' ? 'ran-bom' : 'ran-epms',
      originalFileName: prevalidatedFileId === 'ran-bom-1' ? 'BOM.xlsx' : 'EPMS.xlsx',
      passed: true,
      reusable: true,
      checklist: []
    }));
    const wrapper = mountView();
    sessionStorage.setItem('awp.prCreator.reusableRanUploads', JSON.stringify({
      bomPrevalidatedFileId: 'ran-bom-1',
      epmsPrevalidatedFileId: 'ran-epms-1',
      runMode: 'general-item',
      selectedProject: 'Project Alpha'
    }));

    await wrapper.vm.restoreReusableRanUploads();

    expect(getPrevalidatedUpload).toHaveBeenCalledWith('ran-bom-1', wrapper.vm.browserTabSessionId);
    expect(getPrevalidatedUpload).toHaveBeenCalledWith('ran-epms-1', wrapper.vm.browserTabSessionId);
    expect(wrapper.vm.ranBomPrevalidation.originalFileName).toBe('BOM.xlsx');
    expect(wrapper.vm.ranEpmsPrevalidation.originalFileName).toBe('EPMS.xlsx');
    expect(wrapper.vm.ranRunMode).toBe('general-item');
    expect(wrapper.vm.ranSelectedProject).toBe('Project Alpha');
  });
});
