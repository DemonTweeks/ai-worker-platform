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

  it('preserves Planning between MW and uploader and clears it for unsupported workers', async () => {
    const wrapper = mount(JobHistoryFilters, { propsData: { value: buildFilters({ workerId: 'create-pr-cd', prScope: 'PLANNING' }) } });
    expect(wrapper.find('option[value="PLANNING"]').exists()).toBe(true);
    await findLabel(wrapper, 'Worker').find('select').setValue('iepms-pr-upload-automation');
    expect(wrapper.emitted('input').at(-1)[0].prScope).toBe('PLANNING');
    await wrapper.setProps({ value: buildFilters({ workerId: 'iepms-pr-upload-automation', prScope: 'PLANNING' }) });
    expect(wrapper.find('option[value="PLANNING"]').exists()).toBe(true);
    await findLabel(wrapper, 'Worker').find('select').setValue('create-pr-cd-ran');
    expect(wrapper.emitted('input').at(-1)[0].prScope).toBe('');
    await wrapper.setProps({ value: buildFilters({ workerId: 'create-pr-cd-ran' }) });
    expect(wrapper.find('option[value="PLANNING"]').exists()).toBe(false);
    await wrapper.setProps({ value: buildFilters() });
    expect(wrapper.find('option[value="PLANNING"]').exists()).toBe(true);
  });

  it('hides scope for TX BOM and clears a stale selection on worker switch', async () => {
    const wrapper = mount(JobHistoryFilters, { propsData: { value: buildFilters({ workerId: 'iepms-pr-upload-automation', prScope: 'PLANNING' }) } });
    await findLabel(wrapper, 'Worker').find('select').setValue('tx-bom-generator');
    expect(wrapper.emitted('input').at(-1)[0]).toEqual(buildFilters({ workerId: 'tx-bom-generator' }));
    await wrapper.setProps({ value: buildFilters({ workerId: 'tx-bom-generator' }) });
    expect(findLabel(wrapper, 'PR Scope')).toBeUndefined();
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
      'iepms-pr-upload-automation',
      'tx-bom-generator',
      'mw-pr',
      'ran-pr',
      'pr-auditor'
    ]));
  });
});
