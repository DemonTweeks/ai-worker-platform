import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import FailureDiagnosis from '../FailureDiagnosis.vue';

describe('FailureDiagnosis.vue Component', () => {
  it('renders PREFLIGHT_FAILED error with pandas/openpyxl, Python path, repair command, and technical details', () => {
    const job = {
      jobId: 'PR-TEST-101',
      status: 'failed',
      failureDiagnosis: {
        category: 'PREFLIGHT_FAILED',
        title: 'Python worker dependency missing',
        summary: 'PR worker preflight check failed because some required Python packages are not installed in the environment.',
        missingPackages: ['pandas', 'openpyxl'],
        pythonExecutable: '/usr/bin/python3',
        recommendedCommand: '"/usr/bin/python3" -m pip install -r requirements-worker.txt',
        technicalDetails: 'ImportError: pandas missing'
      }
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    const text = wrapper.text();
    expect(text).toContain('Python worker dependency missing');
    expect(text).toContain('pandas, openpyxl');
    expect(text).toContain('/usr/bin/python3');
    expect(text).toContain('"/usr/bin/python3" -m pip install -r requirements-worker.txt');
    expect(text).toContain('Technical details');
    expect(wrapper.find('pre').text()).toContain('ImportError: pandas missing');

    // Check that native <details> element has no open attribute by default
    const detailsEl = wrapper.find('details');
    expect(detailsEl.attributes('open')).toBeUndefined();
  });

  it('renders WORKER_PROCESS_FAILED error', () => {
    const job = {
      jobId: 'PR-TEST-102',
      status: 'failed',
      failureDiagnosis: {
        category: 'WORKER_PROCESS_FAILED',
        title: 'Worker process failed',
        summary: 'PR worker child process exited with an error status during execution.',
        scope: 'TSS',
        exitCode: 1,
        technicalDetails: 'RuntimeError: segmentation fault'
      }
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    const text = wrapper.text();
    expect(text).toContain('Worker process failed');
    expect(text).toContain('TSS');
    expect(text).toContain('Exit Code');
    expect(wrapper.find('pre').text()).toContain('RuntimeError: segmentation fault');
  });

  it('renders WORKER_TIMEOUT error', () => {
    const job = {
      jobId: 'PR-TEST-103',
      status: 'failed',
      failureDiagnosis: {
        category: 'WORKER_TIMEOUT',
        title: 'Worker timeout',
        summary: 'PR worker execution exceeded the maximum allowed time limit.',
        technicalDetails: 'Timeout trace'
      }
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    const text = wrapper.text();
    expect(text).toContain('Worker timeout');
    expect(text).toContain('PR worker execution exceeded');
    expect(text).not.toContain('Exit Code');
    expect(wrapper.find('pre').text()).toContain('Timeout trace');
  });

  it('does not render anything if the job is successful', () => {
    const job = {
      jobId: 'PR-TEST-104',
      status: 'completed',
      failureDiagnosis: null
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    expect(wrapper.html()).toBe('');
  });

  it('stubs navigator.clipboard.writeText, clicks Copy Command, and confirms target text', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true
    });

    const job = {
      jobId: 'PR-TEST-105',
      status: 'failed',
      failureDiagnosis: {
        category: 'PREFLIGHT_FAILED',
        recommendedCommand: '"/usr/bin/python3" -m pip install -r requirements-worker.txt'
      }
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    const copyBtn = wrapper.find('button.copy-btn');
    expect(copyBtn.exists()).toBe(true);

    await copyBtn.trigger('click');
    expect(writeTextSpy).toHaveBeenCalledWith('"/usr/bin/python3" -m pip install -r requirements-worker.txt');
  });

  it('ignores raw job.error containing hostile values and does not leak them to HTML', () => {
    const job = {
      jobId: 'PR-TEST-106',
      status: 'failed',
      failureDiagnosis: {
        category: 'WORKER_PROCESS_FAILED',
        title: 'Worker process failed',
        summary: 'PR worker child process exited with an error status during execution.',
        technicalDetails: 'Safe redacted technical details [redacted]'
      },
      error: {
        message: 'Unsafe path C:\\Users\\JJ\\private\\uploads\\secret.xlsx',
        details: {
          stdout: 'Unsafe output with LLM_API_KEY=another-secret',
          stderr: 'Authorization: Bearer bearer-secret-value'
        }
      }
    };

    const wrapper = mount(FailureDiagnosis, {
      propsData: { job }
    });

    const html = wrapper.html();
    // Assert native <details> has no open attribute by default
    const detailsEl = wrapper.find('details');
    expect(detailsEl.attributes('open')).toBeUndefined();

    // Assert rendered HTML contains none of the hostile job.error values
    expect(html).not.toContain('C:\\Users\\JJ\\private\\uploads\\secret.xlsx');
    expect(html).not.toContain('LLM_API_KEY=another-secret');
    expect(html).not.toContain('bearer-secret-value');
    expect(html).not.toContain('Authorization: Bearer');

    // Assert safe technical details are present
    expect(html).toContain('Safe redacted technical details [redacted]');
  });
});
