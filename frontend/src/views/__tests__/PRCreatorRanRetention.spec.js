import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PRCreatorView from '../PRCreatorView.vue';
import { getPrevalidatedUpload } from '../../api/jobApi';

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
    RouterLink: {
      props: ['to'],
      template: '<a><slot /></a>'
    },
    UploadPanel: {
      props: ['title', 'inputLabel', 'validateLabel', 'inputHint'],
      template: '<div class="upload-panel-stub">{{ title }}</div>'
    },
    LoadingButton: {
      props: ['label'],
      template: '<button type="button">{{ label }}</button>'
    }
  }
});

const restoredUpload = (prevalidatedFileId) => ({
  prevalidatedFileId,
  uploadKind: prevalidatedFileId.includes('bom') ? 'ran-bom' : 'ran-epms',
  originalFileName: prevalidatedFileId.includes('bom') ? 'BOM.xlsx' : 'EPMS.xlsx',
  passed: true,
  reusable: true,
  checklist: []
});

describe('PRCreatorView partial RAN retained uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    getPrevalidatedUpload.mockReset();
  });

  it.each([
    {
      label: 'BOM-only',
      storedKey: 'bomPrevalidatedFileId',
      prevalidatedFileId: 'ran-bom-1',
      restoredStateKey: 'ranBomPrevalidation'
    },
    {
      label: 'EPMS-only',
      storedKey: 'epmsPrevalidatedFileId',
      prevalidatedFileId: 'ran-epms-1',
      restoredStateKey: 'ranEpmsPrevalidation'
    }
  ])('restores $label state without a false missing-upload warning', async ({
    storedKey,
    prevalidatedFileId,
    restoredStateKey
  }) => {
    getPrevalidatedUpload.mockResolvedValue(restoredUpload(prevalidatedFileId));
    const wrapper = mountView();
    await flushPromises();
    sessionStorage.setItem('awp.prCreator.reusableRanUploads', JSON.stringify({
      [storedKey]: prevalidatedFileId,
      runMode: 'standard-pr',
      selectedProject: ''
    }));

    await wrapper.vm.restoreReusableRanUploads();

    expect(getPrevalidatedUpload).toHaveBeenCalledTimes(1);
    expect(wrapper.vm[restoredStateKey].prevalidatedFileId).toBe(prevalidatedFileId);
    expect(wrapper.vm.commandNotice).toBe('');
  });

  it('warns when an upload ID that was actually stored cannot be restored', async () => {
    getPrevalidatedUpload.mockImplementation(async (prevalidatedFileId) => {
      if (prevalidatedFileId === 'ran-epms-missing') {
        throw new Error('Retained upload expired');
      }
      return restoredUpload(prevalidatedFileId);
    });
    const wrapper = mountView();
    await flushPromises();
    sessionStorage.setItem('awp.prCreator.reusableRanUploads', JSON.stringify({
      bomPrevalidatedFileId: 'ran-bom-available',
      epmsPrevalidatedFileId: 'ran-epms-missing',
      runMode: 'standard-pr',
      selectedProject: ''
    }));

    await wrapper.vm.restoreReusableRanUploads();

    expect(wrapper.vm.ranBomPrevalidation.prevalidatedFileId).toBe('ran-bom-available');
    expect(wrapper.vm.ranEpmsPrevalidation).toBe(null);
    expect(wrapper.vm.commandNotice).toContain('previously validated RAN uploads are no longer available');
  });
});
