import fs from 'fs';
import path from 'path';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardView from '../DashboardView.vue';
import { listJobs } from '../../api/jobApi';
import { formatCompactDateTime } from '../../utils/formatUtils';

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

  it('formats active job creation timestamps in local time', async () => {
    const createdAt = '2026-08-07T06:29:20.286Z';
    listJobs.mockResolvedValueOnce({
      items: [{
        jobId: 'PR-20260807-007',
        workerId: 'mw-pr',
        workerDisplayName: 'MW PR Worker',
        status: 'validating',
        createdAt
      }]
    });
    const wrapper = mount(DashboardView, {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>'
        }
      }
    });

    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(formatCompactDateTime(createdAt));
    expect(wrapper.text()).not.toContain(createdAt);
  });

  it('keeps Active Jobs fitted to the card without horizontal scrolling', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/DashboardView.vue'),
      'utf8'
    );

    expect(source).toContain('grid-column: 1 / -1');
    expect(source).toContain('table-layout: fixed');
    expect(source).toContain('overflow-x: hidden');
    expect(source).not.toContain('overflow-x: auto');
    expect(source).not.toContain('min-width: 640px');
  });

  it('allows worker Active Jobs timestamps to wrap instead of clipping in narrow fixed columns', () => {
    const mainSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/main.js'),
      'utf8'
    );
    const noScrollStyles = fs.readFileSync(
      path.resolve(process.cwd(), 'src/active-jobs-no-scroll.css'),
      'utf8'
    );
    const dashboardSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/views/DashboardView.vue'),
      'utf8'
    );

    expect(mainSource).toContain("import './active-jobs-no-scroll.css';");
    expect(noScrollStyles).toMatch(/\.workbench-result-card \.job-created-time\s*\{[^}]*white-space:\s*normal/s);
    expect(dashboardSource).toMatch(/\.dashboard-active-jobs-card \.job-created-time\s*\{[^}]*white-space:\s*normal/s);
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