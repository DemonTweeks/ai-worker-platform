import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, getMock, deleteMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
  deleteMock: vi.fn()
}));

vi.mock('../../api', () => ({
  default: {
    post: postMock,
    get: getMock,
    delete: deleteMock,
    defaults: { baseURL: 'http://localhost:3000' }
  }
}));

import { createJob, getPrevalidatedUpload, prevalidateUpload, releasePrevalidatedUpload, rerunJob } from '../jobApi';

describe('jobApi prevalidateUpload', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    deleteMock.mockReset();
  });

  it('uses a scoped 120 second timeout for upload prevalidation requests', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });
    const file = new File(['bom'], 'BOM.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    await prevalidateUpload(file, 'ran-bom', {
      workerId: 'ran-pr',
      browserTabSessionId: 'ran-pr-tab-1234'
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, formData, config] = postMock.mock.calls[0];
    expect(url).toBe('/api/jobs/prevalidate');
    expect(formData.get('file')).toBe(file);
    expect(formData.get('uploadKind')).toBe('ran-bom');
    expect(formData.get('workerId')).toBe('ran-pr');
    expect(formData.get('browserTabSessionId')).toBe('ran-pr-tab-1234');
    expect(config).toMatchObject({
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    });
  });

  it('allows job creation setup to run beyond the global request timeout', async () => {
    postMock.mockResolvedValueOnce({ data: { job: { jobId: 'PR-001' } } });
    const payload = {
      workerId: 'pr-auditor',
      finalPoPrevalidatedFileId: 'final-po-upload',
      epmsPrevalidatedFileId: 'epms-upload'
    };

    await createJob(payload);

    expect(postMock).toHaveBeenCalledWith('/api/jobs', payload, {
      timeout: 120000
    });
  });

  it('requests a rerun for the encoded source job ID', async () => {
    postMock.mockResolvedValueOnce({ data: { job: { jobId: 'PR-NEW' } } });

    const result = await rerunJob('PR/SOURCE');

    expect(postMock).toHaveBeenCalledWith('/api/jobs/PR%2FSOURCE/rerun', {}, {
      timeout: 120000
    });
    expect(result.job.jobId).toBe('PR-NEW');
  });

  it('retrieves and releases a reusable validated upload within the browser session', async () => {
    getMock.mockResolvedValueOnce({ data: { prevalidatedFileId: 'preval-1', reusable: true } });
    deleteMock.mockResolvedValueOnce({});

    await expect(getPrevalidatedUpload('preval-1', 'tab-1')).resolves.toMatchObject({ reusable: true });
    await releasePrevalidatedUpload('preval-1', 'tab-1');

    expect(getMock).toHaveBeenCalledWith('/api/jobs/prevalidated/preval-1', {
      params: { browserTabSessionId: 'tab-1' }
    });
    expect(deleteMock).toHaveBeenCalledWith('/api/jobs/prevalidated/preval-1', {
      params: { browserTabSessionId: 'tab-1' }
    });
  });
});
