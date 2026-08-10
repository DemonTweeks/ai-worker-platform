import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PRCreatorView from '../PRCreatorView.vue';
import { getJobDetail, getPrevalidatedUpload, releasePrevalidatedUpload } from '../../api/jobApi';

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

const flushPromises = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const mountView = () => mount(PRCreatorView, {
  stubs: {
    RouterLink: {
      props: ['to'],
      template: '<a><slot /></a>'
    },
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

  it('opens the stop-job confirmation and scrolls to Result Delivery', async () => {
    const wrapper = mountView();
    await wrapper.vm.restoreActiveJobs();
    await wrapper.setData({
      activeSessionJobs: [{
        jobId: 'PR-20260720-001',
        workerId: 'mw-pr',
        workerDisplayName: 'MW PR Worker',
        status: 'generating',
        createdAt: '2026-07-20T02:14:55.000Z'
      }],
      currentJobId: 'PR-20260720-001',
      currentStatus: 'generating'
    });
    const scrollIntoView = vi.fn();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const stopButton = wrapper.findAll('button').wrappers.find((button) => button.text() === 'Stop / Cancel');

    await stopButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.showCancelForm).toBe(true);
    expect(wrapper.vm.$refs.cancellationPanel.textContent).toContain('Result Delivery');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
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

  it('keeps a terminal job selected so Result Delivery exposes its completed output', async () => {
    getJobDetail.mockResolvedValue({
      job: {
        jobId: 'PR-20260806-002',
        workerId: 'mw-pr',
        workerDisplayName: 'MW PR Worker',
        status: 'completed_with_warning',
        requestedSiteCount: 13,
        matchedSiteCount: 13,
        unmatchedSiteCount: 0,
        outputFileCount: 1,
        warningCount: 3,
        reviewRequiredCount: 3,
        updatedAt: '2026-08-06T01:18:40.403Z'
      },
      outputs: [{
        id: 'zip-output-1',
        fileType: 'zip_package',
        available: true
      }],
      finalWorkerSummary: 'The PR Worker task completed successfully.'
    });
    const wrapper = mountView();
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    await wrapper.setData({
      currentJobId: 'PR-20260806-002',
      currentStatus: 'generating',
      activeSessionJobs: [{
        jobId: 'PR-20260806-002',
        workerId: 'mw-pr',
        workerDisplayName: 'MW PR Worker',
        status: 'generating',
        createdAt: '2026-08-06T01:17:40.403Z'
      }]
    });

    wrapper.vm.applyRealtimeMessage({
      type: 'JOB_EVENT',
      status: 'completed_with_warning',
      updatedAt: '2026-08-06T01:18:40.403Z'
    });
    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentJobId).toBe('PR-20260806-002');
    expect(wrapper.vm.jobDetail.job.status).toBe('completed_with_warning');
    expect(wrapper.vm.visibleActiveSessionJobs).toHaveLength(0);
    expect(wrapper.vm.canDownload).toBe(true);
    expect(wrapper.text()).toContain('Download ZIP');
    expect(wrapper.text()).not.toContain('Create a Job to enable result delivery.');
  });

  it('links completed output results to the job detail download page', () => {
    const wrapper = mountView();
    wrapper.vm.currentJobId = 'PR-20260721-001';
    wrapper.vm.currentStatus = 'completed';
    wrapper.vm.jobDetail = {
      job: {
        jobId: 'PR-20260721-001',
        status: 'completed',
        outputFileCount: 1,
        updatedAt: '2026-07-21T03:04:20.000Z'
      },
      outputs: [{ id: 'output-1' }],
      finalWorkerSummary: 'Task completed.'
    };

    const finalSummary = wrapper.vm.buildSharedConsoleItems().find((item) => item.id === 'final-summary');
    expect(finalSummary.outputJobId).toBe('PR-20260721-001');

    wrapper.vm.jobDetail.job.status = 'failed';
    wrapper.vm.jobDetail.job.outputFileCount = null;
    const failedSummary = wrapper.vm.buildSharedConsoleItems().find((item) => item.id === 'final-summary');
    expect(failedSummary.outputJobId).toBe('');
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
