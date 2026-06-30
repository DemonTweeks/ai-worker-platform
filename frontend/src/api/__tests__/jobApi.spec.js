import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, getMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn()
}));

vi.mock('../../api', () => ({
  default: {
    post: postMock,
    get: getMock,
    defaults: { baseURL: 'http://localhost:3000' }
  }
}));

import { prevalidateUpload } from '../jobApi';

describe('jobApi prevalidateUpload', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
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
});
