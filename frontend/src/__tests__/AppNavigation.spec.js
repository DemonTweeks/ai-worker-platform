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

  it('keeps worker navigation active while Dashboard stays inactive on worker routes', async () => {
    const wrapper = await mountAtRoute('/workers/pr-creator');
    await wrapper.vm.$nextTick();

    const prCreatorLink = findLinkByText(wrapper, 'PR Creator');
    const dashboardLink = findLinkByText(wrapper, 'Dashboard');

    expect(prCreatorLink.classes()).toContain('router-link-exact-active');
    expect(dashboardLink.classes()).not.toContain('router-link-exact-active');
  });

  it('activates Dashboard only on the dashboard route', async () => {
    const wrapper = await mountAtRoute('/dashboard');
    await wrapper.vm.$nextTick();

    const prCreatorLink = findLinkByText(wrapper, 'PR Creator');
    const dashboardLink = findLinkByText(wrapper, 'Dashboard');

    expect(dashboardLink.classes()).toContain('router-link-exact-active');
    expect(prCreatorLink.classes()).not.toContain('router-link-exact-active');
  });
});
