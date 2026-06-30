import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ReAskPanel from '../ReAskPanel.vue';

const mountPanel = (propsData = {}) => mount(ReAskPanel, {
  propsData: {
    jobId: 'JOB-1',
    loading: false,
    answer: null,
    value: '',
    ...propsData
  }
});

describe('ReAskPanel', () => {
  it('submits a non-empty question when Enter is pressed without Shift', async () => {
    const wrapper = mountPanel({ value: 'Why were sites unmatched?' });

    const textarea = wrapper.find('textarea');
    await textarea.trigger('keydown.enter', {
      key: 'Enter',
      shiftKey: false,
      preventDefault: () => {}
    });

    expect(wrapper.emitted('submit-question')).toEqual([[{ question: 'Why were sites unmatched?' }]]);
  });

  it('preserves multiline input when Shift+Enter is pressed', async () => {
    const wrapper = mountPanel({ value: 'First line' });

    const textarea = wrapper.find('textarea');
    await textarea.trigger('keydown.enter', {
      key: 'Enter',
      shiftKey: true,
      preventDefault: () => {}
    });

    expect(wrapper.emitted('submit-question')).toBeUndefined();
  });

  it('rejects whitespace-only submission attempts', async () => {
    const wrapper = mountPanel({ value: '   ' });

    const textarea = wrapper.find('textarea');
    await textarea.trigger('keydown.enter', {
      key: 'Enter',
      shiftKey: false,
      preventDefault: () => {}
    });

    expect(wrapper.emitted('submit-question')).toBeUndefined();
  });

  it('disables the Ask button and textarea while submitting', async () => {
    const wrapper = mountPanel({ value: 'Question', loading: true });

    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
  });

  it('emits draft updates instead of owning local draft state', async () => {
    const wrapper = mountPanel({ value: 'Old question' });

    const textarea = wrapper.find('textarea');
    await textarea.setValue('New question');

    expect(wrapper.emitted('input')).toEqual([['New question']]);
  });
});
