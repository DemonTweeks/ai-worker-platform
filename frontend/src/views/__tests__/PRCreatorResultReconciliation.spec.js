import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PRCreatorView from '../PRCreatorView.vue';

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
    RouterLink: { template: '<a><slot /></a>' },
    UploadPanel: { template: '<div />' },
    LoadingButton: { template: '<button type="button">Create Job</button>' }
  }
});

describe('PRCreatorView result reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows reconciled site counts in Result Delivery using business wording', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.setData({
      currentJobId: 'PR-ISSUE88-001',
      currentStatus: 'completed_with_warning',
      jobDetail: {
        job: {
          jobId: 'PR-ISSUE88-001',
          workerId: 'mw-pr',
          status: 'completed_with_warning',
          requestedSiteCount: 24,
          matchedSiteCount: 24,
          unmatchedSiteCount: 0,
          outputFileCount: 1,
          reviewRequiredCount: 16,
          warningCount: 0,
          generatedSiteCount: 8,
          reviewRequiredSiteCount: 16,
          approvedIgnoredSiteCount: 0,
          duplicateBlockedSiteCount: 0,
          failedSiteCount: 0,
          accountedSiteCount: 24,
          unaccountedSiteCount: 0
        },
        outputs: []
      }
    });

    const resultDelivery = wrapper.find('[aria-label="Result reconciliation"]');
    expect(resultDelivery.exists()).toBe(true);
    expect(resultDelivery.text()).toContain('Generated sites8');
    expect(resultDelivery.text()).toContain('Accounted sites24');
    expect(resultDelivery.text()).toContain('Sites without confirmed result0');
    expect(resultDelivery.text()).not.toContain('Unaccounted');
    expect(resultDelivery.text()).toContain('Review sites16');
  });
});
