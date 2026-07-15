import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobDetailTimeline from '../JobDetailTimeline.vue';

const mountTimeline = (job) => mount(JobDetailTimeline, {
  propsData: { job },
  stubs: { JobEventTimeline: true }
});

describe('JobDetailTimeline', () => {
  it('shows authoritative matched site IDs for a completed job', () => {
    const wrapper = mountTimeline({
      status: 'completed',
      createdAt: '2026-07-15T08:21:18.000Z',
      startedAt: '2026-07-15T08:21:18.000Z',
      completedAt: '2026-07-15T08:21:49.000Z',
      matchedSiteCodes: ['SITE-001', 'SITE-002']
    });

    expect(wrapper.text()).toContain('Sites executed');
    expect(wrapper.text()).toContain('2 sites');
    expect(wrapper.text()).toContain('SITE-001, SITE-002');
  });

  it('keeps historical jobs without matched site IDs safe', () => {
    const wrapper = mountTimeline({
      status: 'completed',
      createdAt: '2026-07-15T08:21:18.000Z',
      completedAt: '2026-07-15T08:21:49.000Z'
    });

    expect(wrapper.text()).not.toContain('Sites executed');
    expect(wrapper.text()).toContain('Completed');
  });

  it('does not describe filtered IDs as executed when the worker failed', () => {
    const wrapper = mountTimeline({
      status: 'failed',
      createdAt: '2026-07-15T08:21:18.000Z',
      completedAt: '2026-07-15T08:21:49.000Z',
      matchedSiteCodes: ['SITE-001']
    });

    expect(wrapper.text()).not.toContain('Sites executed');
  });
});
