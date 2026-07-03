import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../DashboardView.vue';

vi.mock('../../api/jobApi', () => ({
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.'),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  listJobs: vi.fn(async () => ({ items: [] }))
}));

describe('DashboardView', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a platform-global dashboard without worker launch controls', async () => {
    const wrapper = mount(DashboardView, {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>'
        }
      }
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.html()).toContain('/workers/pr-creator');
    expect(wrapper.html()).toContain('/workers/pr-auditor');
    expect(wrapper.html()).toContain('/history');
    expect(wrapper.html()).toContain('/admin/health');
    expect(wrapper.text()).not.toContain('Final PO workbook');
    expect(wrapper.text()).not.toContain('Task Type');
    expect(wrapper.text()).not.toContain('Run Audit');
    expect(wrapper.text()).not.toContain('Create Job');
  });
});
