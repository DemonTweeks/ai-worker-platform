import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from '../HomeView.vue';
import { cancelJob, createJob, getHealth, getJobDetail, listJobs, listRanProjects, prevalidateUpload } from '../../api/jobApi';
import { scheduleNotificationDismiss } from '../../utils/workerNotificationUtils';

vi.mock('../../api/jobApi', () => ({
  cancelJob: vi.fn(),
  createJob: vi.fn(),
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  getJobDetail: vi.fn(),
  getZipDownloadUrl: vi.fn(() => '/download.zip'),
  listJobs: vi.fn(async () => ({ items: [], total: 0 })),
  listRanProjects: vi.fn(async () => []),
  prevalidateUpload: vi.fn()
}));

vi.mock('../../api/reAskApi', () => ({
  askJob: vi.fn()
}));

const connectSpy = vi.fn();
const closeSpy = vi.fn();

vi.mock('../../services/websocketClient', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: connectSpy,
    close: closeSpy
  }))
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const timeoutMessage = 'Request timed out. The job may still be running. Please check History.';
const safeValidationFailure = {
  passed: false,
  checklist: [
    { label: 'Workbook can be opened', passed: false }
  ],
  workerExplanation: 'I cannot start the task yet. Workbook must be a valid .xlsx file.'
};

const mountView = () => mount(HomeView, {
  stubs: {
    UploadPanel: true,
    LoadingButton: true
  }
});

const primeCreateState = async (wrapper) => {
  await wrapper.setData({
    selectedFile: { name: 'sites.xlsx' },
    prevalidation: {
      passed: true,
      prevalidatedFileId: 'file-1'
    },
    siteCodesText: 'ABC123'
  });
};

describe('HomeView worker notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows user-friendly timeout wording for timed out create requests', async () => {
    createJob.mockRejectedValueOnce(Object.assign(new Error('timeout of 10000ms exceeded'), {
      code: 'ECONNABORTED'
    }));

    const wrapper = mountView();
    await primeCreateState(wrapper);

    await wrapper.vm.createWorkerJob();
    await flushPromises();

    expect(wrapper.text()).toContain(timeoutMessage);
  });

  it('auto-dismisses timeout notifications after 6 seconds', async () => {
    createJob.mockRejectedValueOnce(Object.assign(new Error('timeout of 10000ms exceeded'), {
      code: 'ECONNABORTED'
    }));

    const wrapper = mountView();
    await primeCreateState(wrapper);

    await wrapper.vm.createWorkerJob();
    await flushPromises();
    expect(wrapper.vm.errorMessage).toBe(timeoutMessage);

    await vi.advanceTimersByTimeAsync(6000);

    expect(wrapper.vm.errorMessage).toBe('');
  });

  it('lets the user manually dismiss the notification', async () => {
    createJob.mockRejectedValueOnce(Object.assign(new Error('Worker request failed'), {
      userMessage: 'Worker request failed.'
    }));

    const wrapper = mountView();
    await primeCreateState(wrapper);

    await wrapper.vm.createWorkerJob();
    await flushPromises();

    const dismissButton = wrapper.find('button[aria-label="Dismiss notification"]');
    expect(dismissButton.exists()).toBe(true);

    await dismissButton.trigger('click');

    expect(wrapper.vm.errorMessage).toBe('');
  });

  it('does not let an older timer clear a newer notification', async () => {
    vi.setSystemTime(new Date('2026-06-24T00:00:00Z'));

    let activeNotificationId = 1;
    let clearedTimers = [];
    let dismissals = [];
    let timerId = 0;
    const timers = new Map();

    const first = scheduleNotificationDismiss({
      activeNotificationId,
      clearTimer: (id) => {
        clearedTimers.push(id);
        timers.delete(id);
      },
      currentTimer: null,
      onDismiss: (dismissedId) => dismissals.push(dismissedId),
      setTimer: (callback, timeoutMs) => {
        timerId += 1;
        timers.set(timerId, { callback, timeoutMs });
        return timerId;
      }
    });

    vi.setSystemTime(new Date('2026-06-24T00:00:03Z'));
    activeNotificationId = 2;

    const second = scheduleNotificationDismiss({
      activeNotificationId,
      clearTimer: (id) => {
        clearedTimers.push(id);
        timers.delete(id);
      },
      currentTimer: first.timer,
      onDismiss: (dismissedId) => dismissals.push(dismissedId),
      setTimer: (callback, timeoutMs) => {
        timerId += 1;
        timers.set(timerId, { callback, timeoutMs });
        return timerId;
      }
    });

    expect(clearedTimers).toEqual([first.timer]);

    vi.setSystemTime(new Date('2026-06-24T00:00:06Z'));
    timers.get(second.timer).callback();
    expect(dismissals).toEqual([]);

    vi.setSystemTime(new Date('2026-06-24T00:00:09Z'));
    timers.get(second.timer).callback();
    expect(dismissals).toEqual([2]);
  });

  it('preserves the existing successful create flow', async () => {
    createJob.mockResolvedValueOnce({
      job: {
        jobId: 'JOB-123',
        prScope: 'TSS',
        status: 'queued',
        phase: 'queued'
      }
    });

    const wrapper = mountView();
    await primeCreateState(wrapper);

    await wrapper.vm.createWorkerJob();
    await flushPromises();

    expect(wrapper.vm.currentJobId).toBe('JOB-123');
    expect(wrapper.vm.errorMessage).toBe('');
    expect(connectSpy).toHaveBeenCalledWith('JOB-123');
    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it('loads workbook-backed ran projects and creates a general-item ran job with dual uploads', async () => {
    listRanProjects.mockResolvedValueOnce({
      projects: ['Project Thanos', 'MSQos_2025']
    });
    createJob.mockResolvedValueOnce({
      job: {
        jobId: 'RAN-123',
        workerId: 'ran-pr',
        runMode: 'general-item',
        selectedProject: 'Project Thanos',
        status: 'queued',
        phase: 'queued'
      }
    });

    const wrapper = mountView();
    await wrapper.vm.handleWorkerChange('ran-pr');
    await flushPromises();

    await wrapper.setData({
      selectedWorkerId: 'ran-pr',
      ranRunMode: 'general-item',
      ranSelectedProject: 'Project Thanos',
      ranBomFile: { name: 'BOM.xlsx' },
      ranEpmsFile: { name: 'EPMS.xlsx' },
      ranBomPrevalidation: {
        passed: true,
        prevalidatedFileId: 'bom-1'
      },
      ranEpmsPrevalidation: {
        passed: true,
        prevalidatedFileId: 'epms-1'
      }
    });

    await wrapper.vm.createWorkerJob();
    await flushPromises();

    expect(listRanProjects).toHaveBeenCalledTimes(1);
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      workerId: 'ran-pr',
      bomPrevalidatedFileId: 'bom-1',
      epmsPrevalidatedFileId: 'epms-1',
      runMode: 'general-item',
      selectedProject: 'Project Thanos'
    }));
    expect(wrapper.vm.currentJobId).toBe('RAN-123');
    expect(connectSpy).toHaveBeenCalledWith('RAN-123');
  });

  it('requires both ran uploads and a project before enabling general-item ran creation', async () => {
    const wrapper = mountView();
    await wrapper.setData({
      selectedWorkerId: 'ran-pr',
      ranRunMode: 'general-item',
      ranBomFile: { name: 'BOM.xlsx' },
      ranEpmsFile: { name: 'EPMS.xlsx' },
      ranBomPrevalidation: {
        passed: true,
        prevalidatedFileId: 'bom-1'
      },
      ranEpmsPrevalidation: null,
      ranSelectedProject: ''
    });

    expect(wrapper.vm.canCreateJob).toBe(false);
    expect(wrapper.vm.createDisabledReason).toContain('Validate both BOM and EPMS');

    await wrapper.setData({
      ranEpmsPrevalidation: {
        passed: true,
        prevalidatedFileId: 'epms-1'
      }
    });

    expect(wrapper.vm.canCreateJob).toBe(false);
    expect(wrapper.vm.createDisabledReason).toContain('Select a validated General Item project');
  });

  it('applies the compact dropdown hook only to the issue 21 project and cancellation selects', async () => {
    const projectWrapper = mountView();
    await flushPromises();

    await projectWrapper.setData({
      selectedWorkerId: 'ran-pr',
      ranRunMode: 'general-item',
      ranProjects: ['Project With A Very Long Workbook Backed Name']
    });

    const projectSelect = projectWrapper.find('select.compact-inline-select');
    expect(projectSelect.exists()).toBe(true);
    expect(projectSelect.attributes('id')).toBeUndefined();
    expect(projectSelect.classes()).toContain('cockpit-sites-input');

    const cancelWrapper = mountView();
    await flushPromises();

    await cancelWrapper.setData({
      activeSessionJobs: [{
        jobId: 'JOB-CANCEL-1',
        status: 'generating',
        workerId: 'ran-pr'
      }],
      currentJobId: 'JOB-CANCEL-1',
      currentStatus: 'generating',
      showCancelForm: true
    });

    const cancelSelect = cancelWrapper.find('#cancel-reason.compact-inline-select');
    expect(cancelSelect.exists()).toBe(true);
    expect(cancelSelect.classes()).toContain('cockpit-sites-input');
  });

  it('disables create and prevalidate while the current worker has an active job', async () => {
    const wrapper = mountView();

    await wrapper.setData({
      activeSessionJobs: [{
        jobId: 'JOB-ACTIVE-1',
        status: 'queued',
        workerId: 'mw-pr'
      }],
      selectedFile: { name: 'sites.xlsx' },
      prevalidation: {
        passed: true,
        prevalidatedFileId: 'file-1'
      },
      siteCodesText: 'ABC123'
    });

    expect(wrapper.vm.canCreateJob).toBe(true);
    expect(wrapper.vm.workerFormLocked).toBe(false);
  });

  it('re-enables create controls after a terminal websocket status update', async () => {
    const wrapper = mountView();

    await wrapper.setData({
      currentJobId: 'JOB-DONE-1',
      currentStatus: 'queued',
      selectedFile: { name: 'sites.xlsx' },
      prevalidation: {
        passed: true,
        prevalidatedFileId: 'file-1'
      },
      siteCodesText: 'ABC123'
    });

    wrapper.vm.applyRealtimeMessage({
      type: 'JOB_EVENT',
      status: 'completed',
      timestamp: '2026-06-29T00:00:00.000Z'
    });

    expect(wrapper.vm.hasActiveWorkerJob).toBe(false);
    expect(wrapper.vm.canCreateJob).toBe(true);
  });

  it('restores all active jobs for the current browser tab session after refresh', async () => {
    listJobs.mockResolvedValueOnce({
      items: [
        {
          jobId: 'JOB-RESTORE-1',
          status: 'queued',
          workerId: 'mw-pr',
          browserTabSessionId: 'tab-restore-1'
        },
        {
          jobId: 'JOB-RESTORE-2',
          status: 'generating',
          workerId: 'ran-pr',
          browserTabSessionId: 'tab-restore-1'
        }
      ],
      total: 2
    });
    getJobDetail.mockResolvedValueOnce({
      job: {
        jobId: 'JOB-RESTORE-1',
        status: 'queued',
        prScope: 'TSS'
      },
      outputs: []
    });
    sessionStorage.setItem('browserTabSessionId', 'tab-restore-1');
    sessionStorage.setItem('selectedJobId', 'JOB-RESTORE-1');

    const wrapper = mountView();
    await flushPromises();

    expect(listJobs).toHaveBeenCalledWith(expect.objectContaining({
      browserTabSessionId: 'tab-restore-1'
    }));
    expect(wrapper.vm.activeSessionJobs).toHaveLength(2);
    expect(wrapper.vm.currentJobId).toBe('JOB-RESTORE-1');
    expect(getJobDetail).toHaveBeenCalledWith('JOB-RESTORE-1');
    expect(connectSpy).toHaveBeenCalledWith('JOB-RESTORE-1');
    expect(wrapper.vm.workerFormLocked).toBe(false);
  });

  it('ignores cross-tab current job leftovers and falls back to an active job from the current browser tab session', async () => {
    listJobs.mockResolvedValueOnce({
      items: [
        {
          jobId: 'JOB-TAB-B-1',
          status: 'generating',
          workerId: 'mw-pr',
          browserTabSessionId: 'tab-restore-2'
        }
      ],
      total: 1
    });
    getJobDetail.mockResolvedValueOnce({
      job: {
        jobId: 'JOB-TAB-B-1',
        status: 'generating',
        prScope: 'TSS'
      },
      outputs: []
    });
    sessionStorage.setItem('browserTabSessionId', 'tab-restore-2');
    localStorage.setItem('currentJobId', 'JOB-OTHER-TAB');

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.vm.currentJobId).toBe('JOB-TAB-B-1');
    expect(getJobDetail).toHaveBeenCalledWith('JOB-TAB-B-1');
  });

  it('submits a controlled cancellation reason for the active job', async () => {
    cancelJob.mockResolvedValueOnce({
      job: {
        jobId: 'JOB-CANCEL-1',
        status: 'cancelling'
      }
    });
    getJobDetail.mockResolvedValueOnce({
      job: {
        jobId: 'JOB-CANCEL-1',
        status: 'cancelling',
        prScope: 'TSS'
      },
      outputs: []
    });

    const wrapper = mountView();
    await flushPromises();
    await wrapper.setData({
      activeSessionJobs: [{
        jobId: 'JOB-CANCEL-1',
        status: 'generating',
        workerId: 'mw-pr'
      }],
      currentJobId: 'JOB-CANCEL-1',
      currentStatus: 'generating',
      cancelReasonCode: 'other',
      cancelReasonText: 'Uploaded the wrong workbook'
    });

    await wrapper.vm.submitCancellationRequest();
    await flushPromises();

    expect(cancelJob).toHaveBeenCalledWith('JOB-CANCEL-1', {
      reasonCode: 'other',
      reasonText: 'Uploaded the wrong workbook'
    });
    expect(wrapper.vm.currentStatus).toBe('cancelling');
  });

  it('shows cancelled partial results with warning tone and partial download labeling', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.setData({
      currentJobId: 'JOB-PARTIAL-1',
      currentStatus: 'cancelled_with_partial_result',
      jobDetail: {
        job: {
          jobId: 'JOB-PARTIAL-1',
          status: 'cancelled_with_partial_result',
          outputFileCount: 1,
          warningCount: 0,
          reviewRequiredCount: 0,
          matchedSiteCount: 0
        },
        outputs: [
          { fileType: 'zip_package', available: true }
        ]
      }
    });

    expect(wrapper.vm.resultTone).not.toBe('success');
    expect(wrapper.vm.resultCompletionMessage.toLowerCase()).toContain('cancel');
    expect(wrapper.text()).toContain('Download Partial ZIP');
    expect(wrapper.text().toLowerCase()).toContain('not a completed delivery');
  });

  it('stores MW prevalidation failure details without showing a generic banner for expected validation 400 responses', async () => {
    prevalidateUpload.mockRejectedValueOnce({
      response: {
        status: 400,
        data: safeValidationFailure
      },
      message: 'Request failed with status code 400'
    });

    const wrapper = mountView();
    const file = new File(['bad'], 'invalid.xls', { type: 'application/vnd.ms-excel' });

    await wrapper.vm.prevalidate(file);
    await flushPromises();

    expect(wrapper.vm.prevalidation).toEqual(safeValidationFailure);
    expect(wrapper.vm.errorMessage).toBe('');
    expect(wrapper.text()).not.toContain('Request failed with status code 400');
    expect(prevalidateUpload).toHaveBeenCalledWith(file, null, expect.objectContaining({
      workerId: 'mw-pr'
    }));
  });

  it('stores RAN BOM and EPMS prevalidation failure details without showing a generic banner for expected validation 400 responses', async () => {
    prevalidateUpload
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: safeValidationFailure
        },
        message: 'Request failed with status code 400'
      })
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: safeValidationFailure
        },
        message: 'Request failed with status code 400'
      });

    const wrapper = mountView();
    const bomFile = new File(['bad-bom'], 'invalid-bom.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const epmsFile = new File(['bad-epms'], 'invalid-epms.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    await wrapper.vm.prevalidateRanUpload('bom', bomFile);
    await wrapper.vm.prevalidateRanUpload('epms', epmsFile);
    await flushPromises();

    expect(wrapper.vm.ranBomPrevalidation).toEqual(safeValidationFailure);
    expect(wrapper.vm.ranEpmsPrevalidation).toEqual(safeValidationFailure);
    expect(wrapper.vm.errorMessage).toBe('');
    expect(wrapper.text()).not.toContain('Request failed with status code 400');
    expect(prevalidateUpload).toHaveBeenNthCalledWith(1, bomFile, 'ran-bom', expect.objectContaining({
      workerId: 'ran-pr'
    }));
    expect(prevalidateUpload).toHaveBeenNthCalledWith(2, epmsFile, 'ran-epms', expect.objectContaining({
      workerId: 'ran-pr'
    }));
  });

  it('still shows a safe generic banner for network or unexpected prevalidation failures', async () => {
    prevalidateUpload.mockRejectedValueOnce(new Error('Network Error'));

    const wrapper = mountView();
    const file = new File(['bad'], 'invalid.xls', { type: 'application/vnd.ms-excel' });

    await wrapper.vm.prevalidate(file);
    await flushPromises();

    expect(wrapper.vm.prevalidation).toBe(null);
    expect(wrapper.vm.errorMessage).toBe('Network Error');
    expect(wrapper.text()).toContain('Network Error');
  });
});
