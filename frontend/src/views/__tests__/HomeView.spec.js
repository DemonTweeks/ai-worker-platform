import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from '../HomeView.vue';
import { createJob, getHealth, listRanProjects } from '../../api/jobApi';
import { scheduleNotificationDismiss } from '../../utils/workerNotificationUtils';

vi.mock('../../api/jobApi', () => ({
  createJob: vi.fn(),
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  getJobDetail: vi.fn(),
  getZipDownloadUrl: vi.fn(() => '/download.zip'),
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
    expect(createJob).toHaveBeenCalledWith({
      workerId: 'ran-pr',
      bomPrevalidatedFileId: 'bom-1',
      epmsPrevalidatedFileId: 'epms-1',
      runMode: 'general-item',
      selectedProject: 'Project Thanos'
    });
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
});
