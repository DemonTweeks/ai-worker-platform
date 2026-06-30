import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JobDetailView from '../JobDetailView.vue';
import { askJob } from '../../api/reAskApi';
import { getErrorMessage, getJobDetail } from '../../api/jobApi';

vi.mock('../../api/jobApi', () => ({
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getJobDetail: vi.fn()
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

const completedDetail = {
  job: {
    jobId: 'JOB-DETAIL-1',
    status: 'completed'
  },
  outputs: [],
  warnings: [],
  reviewRequiredItems: [],
  assetVersions: {}
};

const mountView = async () => {
  getJobDetail.mockResolvedValue(completedDetail);

  const wrapper = mount(JobDetailView, {
    propsData: {
      jobId: 'JOB-DETAIL-1'
    },
    stubs: {
      ErrorBanner: { template: '<div class="error-banner">{{ message }}</div>', props: ['message'] },
      FinalSummary: true,
      FailureDiagnosis: true,
      JobDetailAssetVersions: true,
      JobDetailFiles: true,
      JobDetailHeader: true,
      JobDetailReviewRequired: true,
      JobDetailSummary: true,
      JobDetailTimeline: true,
      JobDetailWarnings: true,
      routerLink: true
    }
  });

  await Promise.resolve();
  await Promise.resolve();

  return wrapper;
};

describe('JobDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears the draft only after askJob succeeds', async () => {
    askJob.mockResolvedValueOnce({
      answer: 'Because of missing data',
      answerSource: 'llm',
      llmStatus: 'success',
      question: 'Why?'
    });

    const wrapper = await mountView();
    await wrapper.setData({
      reAskDraft: 'Why?'
    });

    await wrapper.vm.askQuestion('Why?');

    expect(wrapper.vm.reAskDraft).toBe('');
    expect(wrapper.vm.reAskAnswer.answer).toBe('Because of missing data');
  });

  it('retains the draft when askJob fails', async () => {
    askJob.mockRejectedValueOnce(new Error('Network Error'));

    const wrapper = await mountView();
    await wrapper.setData({
      reAskDraft: 'Keep me'
    });

    await wrapper.vm.askQuestion('Keep me');

    expect(wrapper.vm.reAskDraft).toBe('Keep me');
    expect(wrapper.vm.errorMessage).toBe('Network Error');
  });

  it('prevents duplicate submissions while a request is active', async () => {
    let resolveRequest;
    askJob.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const wrapper = await mountView();
    await wrapper.setData({
      reAskDraft: 'Why?'
    });

    const firstPromise = wrapper.vm.askQuestion('Why?');
    const secondPromise = wrapper.vm.askQuestion('Why?');

    expect(askJob).toHaveBeenCalledTimes(1);

    resolveRequest({
      answer: 'Only once',
      answerSource: 'llm',
      llmStatus: 'success',
      question: 'Why?'
    });

    await firstPromise;
    await secondPromise;
  });

  it('keeps the submitted question associated exactly once with the rendered answer', async () => {
    askJob.mockResolvedValueOnce({
      answer: 'Answered',
      answerSource: 'llm',
      llmStatus: 'success',
      question: 'What happened?'
    });

    const wrapper = await mountView();
    await wrapper.setData({
      reAskDraft: 'What happened?'
    });

    await wrapper.vm.askQuestion('What happened?');

    expect(wrapper.vm.lastSubmittedQuestion).toBe('What happened?');
    expect(wrapper.findComponent({ name: 'ReAskPanel' }).props('answer').question).toBe('What happened?');
  });
});
