import { describe, expect, it } from 'vitest';
import router from '../router';

const waitForNavigation = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

describe('worker routing', () => {
  it('redirects the root route to the PR Creator worker route', async () => {
    await router.push('/');
    await waitForNavigation();

    expect(router.currentRoute.path).toBe('/workers/pr-creator');
  });

  it('supports direct navigation to the PR Creator and PR Auditor worker routes', async () => {
    await router.replace('/history');
    await waitForNavigation();

    await router.push('/workers/pr-creator');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('pr-creator');

    await router.push('/workers/pr-auditor');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('pr-auditor');
  });

  it('keeps the dashboard route independent from worker routes', async () => {
    await router.replace('/history');
    await waitForNavigation();

    await router.push('/dashboard');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('dashboard');

    await router.push('/workers/pr-creator');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('pr-creator');
    expect(router.currentRoute.path).toBe('/workers/pr-creator');
  });

  it('keeps global routes reachable alongside worker routes', async () => {
    await router.push('/history');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('job-history');

    await router.push('/admin/login');
    await waitForNavigation();
    expect(router.currentRoute.name).toBe('admin-login');
  });
});
