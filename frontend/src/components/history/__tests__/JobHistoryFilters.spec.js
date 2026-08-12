import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JobHistoryFilters from '../JobHistoryFilters.vue';

const buildFilters = (overrides = {}) => ({
  search: '',
  status: '',
  workerId: '',
  prScope: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt_desc',
  ...overrides
});

const findLabel = (wrapper, labelText) => (
  wrapper.findAll('label').wrappers.find((label) => label.text().includes(labelText))
);

describe('JobHistoryFilters worker-aware PR Scope', () => {
  it('hides PR Scope for PR Auditor and keeps it for PR Creator workers', async () => {
    const wrapper = mount(JobHistoryFilters, {
      propsData: {
        value: buildFilters({ workerId: 'pr-auditor', prScope: 'TSS' })
      }
    });

    expect(findLabel(wrapper, 'PR Scope')).toBeUndefined();

    await wrapper.setProps({
      value: buildFilters({ workerId: 'mw-pr', prScope: 'TSS' })
    });

    expect(findLabel(wrapper, 'PR Scope')).toBeTruthy();
  });

  it('clears a stale PR Scope when switching to PR Auditor', async () => {
    const wrapper = mount(JobHistoryFilters, {
      propsData: {
        value: buildFilters({ workerId: 'mw-pr', prScope: 'TI' })
      }
    });

    const workerSelect = findLabel(wrapper, 'Worker').find('select');
    await workerSelect.setValue('pr-auditor');

    const emittedValues = wrapper.emitted('input');
    expect(emittedValues).toBeTruthy();
    expect(emittedValues.at(-1)[0]).toEqual(buildFilters({
      workerId: 'pr-auditor',
      prScope: ''
    }));
  });

  it('offers generic skill workers while retaining legacy history filters', () => {
    const wrapper = mount(JobHistoryFilters, {
      propsData: { value: buildFilters() }
    });

    const values = wrapper.findAll('option').wrappers.map((option) => option.attributes('value'));
    expect(values).toEqual(expect.arrayContaining([
      'create-pr-cd',
      'create-pr-cd-ran',
      'tx-pr-auditor',
      'mw-pr',
      'ran-pr',
      'pr-auditor'
    ]));
  });
});
