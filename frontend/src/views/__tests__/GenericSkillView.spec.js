import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GenericSkillView from '../GenericSkillView.vue';
import { createSkillJob, listJobs } from '../../api/jobApi';

vi.mock('../../services/websocketClient', () => ({
  default: class {
    connect() {}
    close() {}
  }
}));

vi.mock('../../api/jobApi', () => ({
  cancelJob: vi.fn(),
  getFileDownloadUrl: vi.fn(() => '/download/file'),
  getHealth: vi.fn(async () => ({ status: 'ok' })),
  getJobDetail: vi.fn(async (jobId) => ({
    job: { jobId, workerId: 'create-pr-cd', workerType: 'skill', status: 'queued' },
    outputs: []
  })),
  getZipDownloadUrl: vi.fn(() => '/download/zip'),
  getErrorMessage: vi.fn((error) => error.message),
  listJobs: vi.fn(async () => ({ items: [] })),
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
            siteCodes: { type: 'array' },
            nonProductionUat: { type: 'boolean', default: false }
          }
        }
      },
      ui: {
        workerLabel: 'MW PR Worker',
        hero: {
          title: 'Launch PR Creator jobs with MW PR and RAN PR modes.',
          subtitle: 'Reference workbench shell',
          chips: ['MW PR Worker', 'Validate'],
          includeModeChip: true
        },
        workbench: { title: 'PR Creator' },
        actions: { primaryLabel: 'Create Job', readyLabel: 'Ready to create Job' },
        uploads: {
          site_data: {
            title: 'Upload & Validate',
            label: 'Source file (iEPMS export)',
            hint: 'Accepted file type: .xlsx.',
            actionLabel: 'Validate File',
            validationRequired: true
          }
        },
        configuration: {
          mode: { field: 'allSites', labels: { false: 'Single site', true: 'All sites' } },
          switcher: {
            label: 'PR Creator Mode',
            options: [
              { skillId: 'create-pr-cd', label: 'MW PR', routeName: 'pr-creator' },
              { skillId: 'create-pr-cd-ran', label: 'RAN PR', routeName: 'ran-pr-creator' }
            ]
          },
          fieldOrder: ['allSites', 'scope']
        },
        parameters: {
          allSites: {
            label: 'Site mode',
            control: 'segmented',
            options: [{ value: false, label: 'Single site' }, { value: true, label: 'All sites' }]
          },
          scope: { label: 'Task Type', control: 'segmented' },
          siteCodes: {
            label: 'Sites',
            placement: 'detail',
            summaryLabel: 'site(s)',
            visibleWhen: { field: 'allSites', equals: false },
            requiredWhenVisible: true,
            omitWhenHidden: true
          },
          nonProductionUat: { hidden: true, default: false }
        }
      }
    }, {
      skillId: 'tx-pr-auditor',
      displayName: 'TX PR Auditor',
      inputs: {
        files: [
          { name: 'final_po', required: true, multiple: false, acceptedExtensions: ['.xlsx'] },
          { name: 'epms', required: true, multiple: false, acceptedExtensions: ['.xlsx', '.xlsm'] }
        ],
        parametersSchema: {
          type: 'object',
          properties: {
            filterYear: { type: 'integer' },
            filterMonth: { type: 'integer' },
            annotateEcc: { type: 'boolean', default: true }
          }
        }
      },
      ui: {
        hero: {
          title: 'Review PO submissions with the dedicated PR Auditor worker.',
          subtitle: 'Upload Final PO and EPMS once. The worker creates ECC entitlement, audits PO claims, and preserves evidence in one controlled run.',
          chips: ['PR Auditor', 'Validate', 'Audit Run']
        },
        workbench: { title: 'PR Auditor' },
        actions: { primaryLabel: 'Run Audit', readyLabel: 'Ready to run audit' },
        uploads: {
          final_po: { title: 'Final PO Upload', label: 'Final PO workbook', hint: 'Upload the current Final PO workbook to be audited.', actionLabel: 'Validate Final PO' },
          epms: { title: 'EPMS Upload', label: 'EPMS workbook', hint: 'Upload EPMS site data. create-pr-cd will generate the TSS and TI entitlement used by the audit.', actionLabel: 'Validate EPMS' }
        },
        uploadGroups: [{
          id: 'audit-period',
          after: 'final_po',
          title: 'Final PO Period',
          subtitle: 'Dispatch Date filter',
          fields: ['filterYear', 'filterMonth']
        }],
        configuration: {
          modeLabel: 'Audit Run',
          stageHeading: 'Controlled two-stage run',
          stages: [
            { title: 'Create entitlement', description: 'create-pr-cd reads EPMS and generates mandatory TSS and TI ECC lines.' },
            { title: 'Audit Final PO', description: 'Compare the submitted PO.' },
            { title: 'Deliver evidence', description: 'Download the result.' }
          ],
          notice: 'One job runs both engines in order. EPMS is never passed into the focused tx-pr-auditor audit engine. Audit findings require business review.'
        },
        parameters: {
          filterYear: { label: 'Year', control: 'select', optionSource: 'years', defaultFrom: 'currentYear' },
          filterMonth: { label: 'Month', control: 'select', optionSource: 'months', defaultFrom: 'currentMonth' },
          annotateEcc: { hidden: true, default: true }
        }
      }
    }]
  })),
  createSkillJob: vi.fn(async () => ({ job: { jobId: 'PR-GENERIC-001' } }))
}));

vi.mock('../../api/reAskApi', () => ({
  askJob: vi.fn()
}));

describe('GenericSkillView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders manifest-owned files and parameters and submits the generic envelope', async () => {
    const wrapper = mount(GenericSkillView, {
      propsData: { skillId: 'create-pr-cd' },
      mocks: { $router: { push: vi.fn(async () => {}) } },
      stubs: { RouterLink: { template: '<a><slot /></a>' } }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Launch PR Creator jobs with MW PR and RAN PR modes.');
    expect(wrapper.text()).toContain('MW PR Worker');
    expect(wrapper.text()).toContain('Upload & Validate');
    expect(wrapper.text()).toContain('Source file (iEPMS export)');
    expect(wrapper.text()).toContain('PR Creator Mode');
    expect(wrapper.text()).toContain('Site mode');
    expect(wrapper.text()).toContain('Task Type');
    expect(wrapper.text()).toContain('Sites');
    expect(wrapper.text()).not.toContain('Non production Uat');
    expect(wrapper.find('.home-cockpit').exists()).toBe(true);
    expect(wrapper.find('.workbench-hero').exists()).toBe(true);
    expect(wrapper.find('.workbench-surface').exists()).toBe(true);
    expect(wrapper.find('.workbench-upload-card').exists()).toBe(true);
    expect(wrapper.find('.workbench-config-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('AI Chatbox');
    expect(wrapper.text()).toContain('Live Output');
    expect(wrapper.text()).toContain('Result Delivery');
    expect(wrapper.vm.showLegacyControls).toBe(false);
    expect(wrapper.vm.showOptionalHandoff).toBe(false);
    expect(wrapper.find('.audit-flow-list').exists()).toBe(false);
    expect(listJobs).toHaveBeenCalledWith(expect.objectContaining({
      workerType: 'skill',
      workerId: 'create-pr-cd'
    }));
    wrapper.vm.$set(wrapper.vm.selectedFiles, 'site_data', new File(['x'], 'sites.xlsx'));
    wrapper.vm.validateSelectedFiles(
      wrapper.vm.skill.inputs.files[0],
      wrapper.vm.selectedFiles.site_data
    );
    wrapper.vm.parameterValues.scope = 'TI';
    wrapper.vm.parameterValues.siteCodes = 'SITE-1\nSITE-2';
    await wrapper.find('form').trigger('submit');

    expect(createSkillJob).toHaveBeenCalledWith('create-pr-cd', expect.objectContaining({
      files: expect.objectContaining({ site_data: expect.any(File) }),
      parameters: { scope: 'TI', allSites: false, siteCodes: ['SITE-1', 'SITE-2'], nonProductionUat: false }
    }));
    expect(wrapper.vm.currentJobId).toBe('PR-GENERIC-001');
  });

  it('places auditor period controls between upload cards and keeps hidden defaults out of the form', async () => {
    const wrapper = mount(GenericSkillView, {
      propsData: { skillId: 'tx-pr-auditor' },
      mocks: { $router: { push: vi.fn(async () => {}) } },
      stubs: { RouterLink: { template: '<a><slot /></a>' } }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    const uploadText = wrapper.find('.workbench-upload-stack').text();
    expect(uploadText.indexOf('Final PO Upload')).toBeLessThan(uploadText.indexOf('Final PO Period'));
    expect(uploadText.indexOf('Final PO Period')).toBeLessThan(uploadText.indexOf('EPMS Upload'));
    expect(wrapper.findAll('.workbench-upload-card')).toHaveLength(3);
    expect(wrapper.find('.audit-period-grid').exists()).toBe(true);
    expect(wrapper.find('.audit-flow-list').exists()).toBe(true);
    expect(wrapper.text()).toContain('Controlled two-stage run');
    expect(wrapper.text()).toContain('create-pr-cd reads EPMS and generates mandatory TSS and TI ECC lines.');
    expect(wrapper.text()).toContain('Upload Final PO and EPMS once.');
    expect(wrapper.text()).toContain('EPMS is never passed into the focused tx-pr-auditor audit engine.');
    expect(wrapper.text()).not.toContain('Expected ECC Upload');
    expect(wrapper.text()).not.toContain('Annotate Ecc');
    expect(wrapper.vm.parameterValues.filterYear).toBe(new Date().getFullYear());
    expect(wrapper.vm.parameterValues.filterMonth).toBe(new Date().getMonth() + 1);
    expect(wrapper.vm.normalizedParameters().annotateEcc).toBe(true);
    expect(listJobs).toHaveBeenCalledWith(expect.objectContaining({
      workerType: 'skill',
      workerId: 'tx-pr-auditor'
    }));
  });
});
