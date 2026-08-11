import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GenericSkillView from '../GenericSkillView.vue';
import { createSkillJob } from '../../api/jobApi';

vi.mock('../../api/jobApi', () => ({
  getErrorMessage: vi.fn((error) => error.message),
  listSkills: vi.fn(async () => ({
    skills: [{
      skillId: 'create-pr-cd',
      displayName: 'Create PR CD',
      inputs: {
        files: [{ name: 'site_data', required: true, multiple: false, acceptedExtensions: ['.xlsx'] }],
        parametersSchema: {
          type: 'object',
          required: ['scope'],
          properties: {
            scope: { type: 'string', enum: ['TSS', 'TI'] },
            allSites: { type: 'boolean', default: false },
            siteCodes: { type: 'array' }
          }
        }
      }
    }]
  })),
  createSkillJob: vi.fn(async () => ({ job: { jobId: 'PR-GENERIC-001' } }))
}));

describe('GenericSkillView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders manifest-owned files and parameters and submits the generic envelope', async () => {
    const push = vi.fn(async () => {});
    const wrapper = mount(GenericSkillView, {
      propsData: { skillId: 'create-pr-cd' },
      mocks: { $router: { push } },
      stubs: { RouterLink: { template: '<a><slot /></a>' } }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Create PR CD');
    expect(wrapper.text()).toContain('Site data');
    expect(wrapper.text()).toContain('Scope');
    expect(wrapper.find('.home-cockpit').exists()).toBe(true);
    expect(wrapper.find('.workbench-hero').exists()).toBe(true);
    expect(wrapper.find('.workbench-surface').exists()).toBe(true);
    expect(wrapper.find('.workbench-upload-card').exists()).toBe(true);
    expect(wrapper.find('.workbench-config-card').exists()).toBe(true);
    wrapper.vm.$set(wrapper.vm.selectedFiles, 'site_data', new File(['x'], 'sites.xlsx'));
    wrapper.vm.parameterValues.scope = 'TI';
    wrapper.vm.parameterValues.siteCodes = 'SITE-1\nSITE-2';
    await wrapper.find('form').trigger('submit');

    expect(createSkillJob).toHaveBeenCalledWith('create-pr-cd', expect.objectContaining({
      files: expect.objectContaining({ site_data: expect.any(File) }),
      parameters: { scope: 'TI', allSites: false, siteCodes: ['SITE-1', 'SITE-2'] }
    }));
    expect(push).toHaveBeenCalledWith({ name: 'job-detail', params: { jobId: 'PR-GENERIC-001' } });
  });
});
