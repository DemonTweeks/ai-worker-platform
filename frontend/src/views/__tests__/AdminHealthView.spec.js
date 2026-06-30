import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminHealthView from '../admin/AdminHealthView.vue';
import { getHealth } from '../../api/jobApi';

vi.mock('../../api/jobApi', () => ({
  getHealth: vi.fn(),
  getErrorMessage: vi.fn((error) => error.userMessage || error.message || 'Request failed.')
}));

const mountView = async () => {
  const wrapper = mount(AdminHealthView, {
    stubs: {
      ErrorBanner: {
        props: ['message'],
        template: '<div class="error-banner">{{ message }}</div>'
      }
    }
  });

  await Promise.resolve();
  await Promise.resolve();
  return wrapper;
};

describe('AdminHealthView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a healthy generic Agnes LLM status from the backend payload', async () => {
    getHealth.mockResolvedValueOnce({
      status: 'ok',
      timestamp: '2026-06-30T14:30:00.000Z',
      services: {
        backend: { status: 'ok' },
        firebase: { status: 'ok', connected: true, latencyMs: 10 },
        storage: { status: 'ok', writable: true, rootLabel: 'storage', disk: { available: true, usedPercent: 10, freeBytes: 1000, totalBytes: 2000 } },
        llm: {
          status: 'ok',
          provider: 'agnes',
          model: 'agnes-2.0-flash',
          configured: true
        },
        queue: { status: 'ok', maxConcurrentJobs: 2, capacityAvailable: 2, activeCount: 0, queuedCount: 0 },
        websocket: { status: 'ok', connectedClients: 0, subscribedJobs: 0, heartbeatIntervalMs: 5000 },
        cleanup: { status: 'available', retentionDays: 180, dryRunSupported: true, automaticScheduleEnabled: false }
      }
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('LLM');
    expect(wrapper.text()).toContain('🟢Healthy');
    expect(wrapper.text()).toContain('agnes · agnes-2.0-flash · configured: yes');
  });

  it('renders degraded LLM status for incomplete configuration returned by the backend', async () => {
    getHealth.mockResolvedValueOnce({
      status: 'degraded',
      timestamp: '2026-06-30T14:31:00.000Z',
      services: {
        backend: { status: 'ok' },
        firebase: { status: 'ok', connected: true, latencyMs: 10 },
        storage: { status: 'ok', writable: true, rootLabel: 'storage', disk: { available: true, usedPercent: 10, freeBytes: 1000, totalBytes: 2000 } },
        llm: {
          status: 'not_configured',
          provider: 'agnes',
          model: 'model unknown',
          configured: false
        },
        queue: { status: 'ok', maxConcurrentJobs: 2, capacityAvailable: 2, activeCount: 0, queuedCount: 0 },
        websocket: { status: 'ok', connectedClients: 0, subscribedJobs: 0, heartbeatIntervalMs: 5000 },
        cleanup: { status: 'available', retentionDays: 180, dryRunSupported: true, automaticScheduleEnabled: false }
      }
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('🟡Degraded');
    expect(wrapper.text()).toContain('agnes · model unknown · configured: no');
  });
});
