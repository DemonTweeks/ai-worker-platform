import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TipicArtifactsView from '../TipicArtifactsView.vue';
import router from '../../router';

const expected = [
  ['Site Lookup Tools', '268'],
  ['2026 Q4 Dashboard', '423'],
  ['Celcomdigi ZTE MW Project Dashboard', '151'],
  ['CelcomDigi 3rd Party MW TX Project Dashboard', '202'],
  ['Pending MOS Scan', '476'],
  ['PO Dashboard', 'https://zte-tx.ddns.net/dashboard/']
];

describe('TX Dashboard', () => {
  it('renders the six exact resource names and direct links', () => {
    const wrapper = mount(TipicArtifactsView);
    expect(wrapper.find('h2').text()).toBe('TX Dashboard');
    const cards = wrapper.findAll('.tipic-card');
    expect(cards.length).toBe(6);
    expected.forEach(([name, id], index) => {
      const card = cards.at(index);
      expect(card.find('h3').text()).toBe(name);
      expect(card.find('a').attributes('href')).toBe(id.startsWith('https://') ? id : `https://tipic.zx.zte.com.cn/api/artifacts/${id}/file`);
      expect(card.find('a').attributes('aria-label')).toContain(name);
    });
    wrapper.destroy();
  });

  it('shows the UAC sign-in instruction and opens every external link safely', () => {
    const wrapper = mount(TipicArtifactsView);
    const note = wrapper.find('.tipic-access-note');
    expect(note.text()).toContain('UAC environment required');
    expect(note.text()).toContain('in the UAC environment and sign in before opening');
    expect(note.find('a').attributes('href')).toBe('https://tipic.zx.zte.com.cn/tipic/');
    expect(wrapper.findAll('a').length).toBe(7);
    wrapper.findAll('a').wrappers.forEach((link) => {
      expect(link.attributes('target')).toBe('_blank');
      expect(link.attributes('rel')).toBe('noopener noreferrer');
    });
    expect(wrapper.find('iframe').exists()).toBe(false);
    wrapper.destroy();
  });

  it('supports the direct hash route without an admin redirect', async () => {
    await router.replace('/history');
    await router.replace('/tx-dashboard');
    expect(router.currentRoute.name).toBe('tx-dashboard');
    expect(router.currentRoute.matched[0].components.default).toBe(TipicArtifactsView);
  });
});
