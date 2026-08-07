import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';

vi.mock('../api/jobApi', () => ({
  getHealth: vi.fn(async () => ({ status: 'ok' }))
}));

const mountedWrappers = [];

const mountApp = () => {
  const wrapper = mount(App, {
    stubs: {
      RouterLink: {
        props: ['to'],
        template: `<a :href="typeof to === 'string' ? to : to.path"><slot /></a>`
      },
      RouterView: {
        template: '<div />'
      }
    }
  });
  mountedWrappers.push(wrapper);
  return wrapper;
};

describe('App navigation', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.destroy());
    vi.useRealTimers();
    vi.clearAllMocks();
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
    expect(wrapper.text()).not.toContain('Status');
    expect(wrapper.html()).not.toContain('/jobs/');
  });

  it('hides on downward scroll and reappears on upward scroll', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true
    });
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
  });

  it('links Dashboard to the platform-global dashboard route', async () => {
    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain('href="/dashboard"');
    expect(wrapper.html()).not.toContain('href="/workers/pr-creator">Dashboard<');
  });
});
