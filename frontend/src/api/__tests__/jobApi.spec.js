import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, getMock } = vi.hoisted(() => ({ postMock: vi.fn(), getMock: vi.fn() }));

vi.mock('../../api', () => ({
  default: {
    post: postMock,
    get: getMock,
    defaults: { baseURL: 'http://localhost:3000' }
  }
}));

import { createSkillJob, getHealth, listSkills, rerunJob } from '../jobApi';

describe('jobApi skill contract', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it('submits manifest-named files and JSON parameters', async () => {
    getMock.mockResolvedValueOnce({ data: { skills: [] } });
    await expect(listSkills()).resolves.toEqual({ skills: [] });
    expect(getMock).toHaveBeenCalledWith('/api/skills');

    postMock.mockResolvedValueOnce({ data: { job: { jobId: 'PR-SKILL-001' } } });
    const source = new File(['source'], 'source.xlsx');
    await createSkillJob('create-pr-cd', {
      files: { site_data: source },
      parameters: { scope: 'TSS', allSites: true },
      browserTabSessionId: 'skill-tab-001',
      idempotencyKey: 'skill-create-001'
    });
    const [url, formData, config] = postMock.mock.calls[0];
    expect(url).toBe('/api/skills/create-pr-cd/jobs');
    expect(formData.get('site_data')).toBe(source);
    expect(JSON.parse(formData.get('parameters'))).toEqual({ scope: 'TSS', allSites: true });
    expect(config.timeout).toBe(120000);
  });

  it('requests a contract rerun for the encoded source job ID', async () => {
    postMock.mockResolvedValueOnce({ data: { job: { jobId: 'PR-NEW' } } });
    const result = await rerunJob('PR/SOURCE');
    expect(postMock).toHaveBeenCalledWith('/api/jobs/PR%2FSOURCE/rerun', {}, { timeout: 120000 });
    expect(result.job.jobId).toBe('PR-NEW');
  });

  it('requests health through the API namespace', async () => {
    getMock.mockResolvedValueOnce({ data: { status: 'ok' } });
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(getMock).toHaveBeenCalledWith('/api/health');
  });
});
