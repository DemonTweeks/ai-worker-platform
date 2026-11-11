import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';

vi.mock('../api/jobApi', () => ({
  getHealth: vi.fn(async () => ({ status: 'ok' }))
}));

const waitForNavigation = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const mountAtRoute = async (path) => {
  await router.push(path);
  await waitForNavigation();

  return mount(App, {
    router,
    stubs: {
      RouterView: {
        template: '<div />'
      }
    }
  });
};

const findLinkByText = (wrapper, text) => wrapper.findAll('a').wrappers.find((link) => link.text().trim() === text);

describe('App navigation state', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await router.replace('/history');
    await waitForNavigation();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Home reachable but inactive on direct worker routes', async () => {
    const wrapper = await mountAtRoute('/workers/pr-creator');
    await wrapper.vm.$nextTick();

    const dashboardLink = findLinkByText(wrapper, 'Home');

    expect(wrapper.find('nav.worker-nav').exists()).toBe(false);
    expect(findLinkByText(wrapper, 'PR Creator')).toBeUndefined();
    expect(dashboardLink.classes()).not.toContain('router-link-exact-active');
  });

  it('orders global navigation with disabled Status when no job is selected', async () => {
    const wrapper = await mountAtRoute('/home');
    const nav = wrapper.find('nav.top-nav');
    expect(nav.findAll('.nav-link').wrappers.map((link) => link.text().trim())).toEqual([
      'Home', 'TX Dashboard', 'Status', 'History', 'Admin'
    ]);
    expect(nav.find('span.nav-link.disabled').text()).toBe('Status');
    expect(findLinkByText(wrapper, 'Home').attributes('href')).toBe('#/home');
    expect(wrapper.html()).not.toContain('href="#/dashboard"');
    expect(wrapper.html()).not.toContain('href="#/tipic-artifacts"');
    wrapper.destroy();
  });

  it('preserves order and selected-job Status destination', async () => {
    sessionStorage.setItem('selectedJobId', 'JOB-NAV-1');
    const wrapper = await mountAtRoute('/home');
    await wrapper.vm.$nextTick();
    const links = wrapper.find('nav.top-nav').findAll('a').wrappers;
    expect(links.map((link) => link.text().trim())).toEqual([
      'Home', 'TX Dashboard', 'Status', 'History', 'Admin'
    ]);
    expect(findLinkByText(wrapper, 'Status').attributes('href')).toBe('#/jobs/JOB-NAV-1');
    wrapper.destroy();
  });

  it('shows and activates TX Dashboard on its own route', async () => {
    const wrapper = await mountAtRoute('/tx-dashboard');
    await wrapper.vm.$nextTick();
    const link = findLinkByText(wrapper, 'TX Dashboard');
    expect(link.attributes('href')).toBe('#/tx-dashboard');
    expect(link.classes()).toContain('router-link-exact-active');
    expect(findLinkByText(wrapper, 'Home').classes()).not.toContain('router-link-exact-active');
    wrapper.destroy();
  });

  it('activates Home only on the home route', async () => {
    const wrapper = await mountAtRoute('/home');
    await wrapper.vm.$nextTick();

    const dashboardLink = findLinkByText(wrapper, 'Home');

    expect(dashboardLink.classes()).toContain('router-link-exact-active');
    expect(wrapper.find('nav.worker-nav').exists()).toBe(false);
  });
});
