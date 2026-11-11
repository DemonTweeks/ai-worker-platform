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

  it('keeps global navigation without the removed worker navigation row', async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('nav.worker-nav').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Worker navigation"]').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('/workers/');
    ['Home', 'History', 'TX Dashboard', 'Admin'].forEach((label) => {
      expect(wrapper.text()).toContain(label);
    });
    wrapper.destroy();
  });

  it('links Home to the platform-global home route', async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain('href="/home"');
    expect(wrapper.html()).not.toContain('href="/workers/pr-creator">Home<');
  });
  it('hides on downward scroll and reappears on upward scroll', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
    const wrapper = mountApp();
    window.scrollY = 120;
    wrapper.vm.handleHeaderScroll();
    vi.advanceTimersByTime(16);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.app-header').classes()).toContain('is-hidden');
    window.scrollY = 80;
    wrapper.vm.handleHeaderScroll();
    vi.advanceTimersByTime(16);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.app-header').classes()).not.toContain('is-hidden');
    wrapper.destroy();
    vi.useRealTimers();
  });

});
