import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';

vi.mock('../api/jobApi', () => ({
  getHealth: vi.fn(async () => ({ status: 'ok' }))
}));

const mountApp = (routeParams = {}) => mount(App, {
  stubs: {
    RouterLink: {
      props: ['to'],
      template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>'
    },
    RouterView: {
      template: '<div />'
    }
  },
  mocks: {
    $route: {
      params: routeParams
    }
  }
});

describe('App selected job navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads the selected job from same-tab session storage instead of cross-tab local storage', async () => {
    sessionStorage.setItem('selectedJobId', 'JOB-TAB-A');
    localStorage.setItem('currentJobId', 'JOB-OTHER-TAB');

    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentJobId).toBe('JOB-TAB-A');
    expect(wrapper.html()).toContain('/jobs/JOB-TAB-A');
    expect(wrapper.html()).not.toContain('/jobs/JOB-OTHER-TAB');
  });

  it('updates the Status link when the selected-job event is dispatched in the same tab', async () => {
    const wrapper = mountApp();
    window.dispatchEvent(new CustomEvent('awp:selected-job-changed', {
      detail: { jobId: 'JOB-LIVE-1' }
    }));

    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentJobId).toBe('JOB-LIVE-1');
    expect(wrapper.html()).toContain('/jobs/JOB-LIVE-1');
  });

  it('renders top-level worker navigation links separately from global navigation', async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain('/workers/pr-creator');
    expect(wrapper.html()).toContain('/workers/pr-auditor');
    expect(wrapper.html()).toContain('/dashboard');
    expect(wrapper.text()).toContain('PR Creator');
    expect(wrapper.text()).toContain('PR Auditor');
    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('History');
    expect(wrapper.text()).toContain('Admin');
  });

  it('links Dashboard to the platform-global dashboard route', async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain('href="/dashboard"');
    expect(wrapper.html()).not.toContain('href="/workers/pr-creator">Dashboard<');
  });
});
