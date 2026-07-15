const assert = require('assert');
const jobService = require('../src/services/jobService');
const { buildRanExecutionError } = require('../src/workers/ranFailureService');
const { sanitizePrAuditorError } = require('../src/workers/prAuditorFailureService');
const { Job, JobFile } = require('../src/models');

const runTests = async () => {
  console.log('--- Running Hardened Error Visibility and Security Tests ---');

  const originalJobFindOne = Job.findOne;
  const originalJobFind = Job.find;
  const originalJobCountDocuments = Job.countDocuments;
  const originalJobFileFind = JobFile.find;

  const resetMocks = () => {
    Job.findOne = originalJobFindOne;
    Job.find = originalJobFind;
    Job.countDocuments = originalJobCountDocuments;
    JobFile.find = originalJobFileFind;
  };

  const hostileStderr = `
Hostile inputs detected:
C:\\Users\\JJ\\uploads\\site_pr_po_view.xlsx
\\\\server\\share\\output.zip
/var/tmp/ai-worker/uploads/input.xlsx
file:///C:/secret/output.xlsx
--input C:\\private\\upload.xlsx
--input="C:\\Users\\JJ\\private uploads\\input.xlsx"
--input C:\\Users\\JJ\\private uploads\\input.xlsx
--input=/var/tmp/private uploads/input.xlsx
OPENAI_API_KEY=super-secret-value
LLM_API_KEY=another-secret
SECRET_TOKEN=private-token
MY_CUSTOM_TOKEN=another-token
AWS_SECRET_ACCESS_KEY=secret
PASSWORD=abc123
Authorization: Bearer bearer-secret-value

Standalone Windows path: C:\\Users\\JJ\\private uploads\\input.xlsx
Standalone UNC path: \\\\server\\share\\private files\\output.zip
Standalone POSIX path: /var/tmp/ai-worker/private uploads/input.xlsx
Standalone file URL: file:///C:/Users/JJ/private%20uploads/input.xlsx
X-API-Key: secret-value
Authorization: Basic basic-secret
  `.trim();

  try {
    // 1. Hostile stderr is redacted; entire secret assignments/bearer credentials are completely redacted (key and value)
    console.log('Assertion 1 & 4 & 5: Hostile stderr path/credential redaction');
    resetMocks();

    const mockPreflightJob = {
      jobId: 'PR-PREFLIGHT-001',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'PREFLIGHT_FAILED',
        message: 'Raw hostile error message containing C:\\Users\\JJ\\uploads\\file.xlsx and LLM_API_KEY=123',
        details: {
          missingPackages: ['pandas', 'unauthorized_pkg'],
          pythonExecutable: '/usr/local/bin/python3\n',
          recommendedCommand: 'raw command path -m pip install',
          stderr: hostileStderr
        }
      }
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockPreflightJob
      }),
      ...mockPreflightJob
    });
    JobFile.find = () => ({
      sort: () => ({
        lean: () => []
      })
    });

    let detailResult = await jobService.getJobDetail('PR-PREFLIGHT-001');
    let jobDetail = detailResult.job;

    // Assert 10: Job Detail output contains no raw error, stdout, stderr, error.message, or error.details
    assert.strictEqual(jobDetail.error, undefined);
    assert.strictEqual(jobDetail.stdout, undefined);
    assert.strictEqual(jobDetail.stderr, undefined);
    assert.strictEqual(jobDetail.message, undefined);

    const diag = jobDetail.failureDiagnosis;
    assert.ok(diag);
    assert.strictEqual(diag.category, 'PREFLIGHT_FAILED');

    // Assert 1: Hostile stderr is redacted
    assert.ok(diag.technicalDetails.includes('[redacted]'));
    assert.strictEqual(diag.technicalDetails.includes('C:\\Users\\JJ\\uploads\\site_pr_po_view.xlsx'), false);
    assert.strictEqual(diag.technicalDetails.includes('\\\\server\\share\\output.zip'), false);
    assert.strictEqual(diag.technicalDetails.includes('/var/tmp/ai-worker/uploads/input.xlsx'), false);
    assert.strictEqual(diag.technicalDetails.includes('file:///C:/secret/output.xlsx'), false);

    // Assert 4: No key names or values remain for environment assignments and bearer credentials
    const terms = ['OPENAI_API_KEY', 'LLM_API_KEY', 'SECRET_TOKEN', 'MY_CUSTOM_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'PASSWORD', 'Authorization', 'Bearer'];
    terms.forEach(term => {
      assert.strictEqual(diag.technicalDetails.includes(term), false, `Technical details must not contain ${term}`);
    });
    assert.strictEqual(diag.technicalDetails.includes('super-secret-value'), false);
    assert.strictEqual(diag.technicalDetails.includes('another-secret'), false);
    assert.strictEqual(diag.technicalDetails.includes('private-token'), false);
    assert.strictEqual(diag.technicalDetails.includes('another-token'), false);
    assert.strictEqual(diag.technicalDetails.includes('bearer-secret-value'), false);

    // Assert 5: Paths with spaces and quoted command arguments are redacted
    assert.strictEqual(diag.technicalDetails.includes('private uploads'), false);
    assert.strictEqual(diag.technicalDetails.includes('input.xlsx'), false);

    // Assert new hostile standalone paths and authentication headers are redacted
    const forbiddenSubstrings = [
      'private uploads',
      'private files',
      'input.xlsx',
      'output.zip',
      'X-API-Key',
      'secret-value',
      'Authorization',
      'Basic',
      'basic-secret'
    ];
    forbiddenSubstrings.forEach(substr => {
      assert.strictEqual(diag.technicalDetails.includes(substr), false, `Technical details must not contain: "${substr}"`);
    });

    // Assert 7: No missingPackages are invented (only validated pandas/openpyxl, not unauthorized_pkg)
    assert.deepStrictEqual(diag.missingPackages, ['pandas']);

    // 2. Hostile stdout and error.message are not used when stderr is absent
    console.log('Assertion 2 & 3: Hostile stdout / error.message are ignored if stderr is absent');
    resetMocks();

    const mockJobNoStderr = {
      jobId: 'PR-FAILED-002',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'WORKER_PROCESS_FAILED',
        message: 'Hostile error.message with C:\\secret\\path.xlsx and LLM_API_KEY=123',
        details: {
          stdout: 'Hostile stdout with C:\\secret\\path.xlsx and LLM_API_KEY=123',
          scope: 'TSS',
          exitCode: 1
        }
      }
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockJobNoStderr
      }),
      ...mockJobNoStderr
    });

    detailResult = await jobService.getJobDetail('PR-FAILED-002');
    jobDetail = detailResult.job;
    const diag2 = jobDetail.failureDiagnosis;
    assert.strictEqual(diag2.technicalDetails, '', 'technicalDetails must be empty string when stderr is absent');

    // 3. Unknown persisted codes become WORKER_ERROR
    console.log('Assertion 6: Unknown persisted codes become WORKER_ERROR');
    resetMocks();

    const mockUnknownJob = {
      jobId: 'PR-UNKNOWN-003',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'SOMETHING_CRITICAL_DIED',
        message: 'crashed',
        details: {
          stderr: 'Hostile stacktrace C:\\Users\\JJ\\upload.xlsx'
        }
      }
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockUnknownJob
      }),
      ...mockUnknownJob
    });

    detailResult = await jobService.getJobDetail('PR-UNKNOWN-003');
    jobDetail = detailResult.job;
    const diag3 = jobDetail.failureDiagnosis;
    assert.strictEqual(diag3.category, 'WORKER_ERROR');
    assert.strictEqual(diag3.title, 'PR Worker execution failed');
    assert.strictEqual(diag3.summary, 'An unexpected error occurred during the PR worker execution process.');
    assert.strictEqual(diag3.technicalDetails.includes('C:\\Users\\JJ\\upload.xlsx'), false);

    // Expected PR Auditor fail-closed condition has specific, diagnostic-free presentation.
    console.log('Assertion 6a: PR Auditor engine-pin block is presented safely');
    resetMocks();

    const enginePinMessage = 'PR Auditor runtime is blocked until a safe engine pin is approved and recorded.';
    const mockBlockedAuditorJob = {
      jobId: 'PR-AUDITOR-BLOCKED-003A',
      workerId: 'pr-auditor',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED',
        message: 'Hostile replacement message C:\\private\\engine.py',
        details: { stderr: hostileStderr, command: '--engine unsafe' }
      }
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockBlockedAuditorJob
      }),
      ...mockBlockedAuditorJob
    });

    detailResult = await jobService.getJobDetail('PR-AUDITOR-BLOCKED-003A');
    jobDetail = detailResult.job;
    assert.strictEqual(jobDetail.failureSummary, enginePinMessage);
    assert.strictEqual(jobDetail.failureDiagnosis.category, 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED');
    assert.strictEqual(jobDetail.failureDiagnosis.title, 'PR Auditor runtime blocked');
    assert.strictEqual(jobDetail.failureDiagnosis.summary, enginePinMessage);
    assert.strictEqual(jobDetail.failureDiagnosis.technicalDetails, '');
    assert.deepStrictEqual(sanitizePrAuditorError(mockBlockedAuditorJob.error), {
      code: 'PR_AUDITOR_ENGINE_PIN_UNAPPROVED',
      message: enginePinMessage,
      details: {}
    });

    // 4. No missingPackages are invented (empty/missing list)
    console.log('Assertion 7 (cont): Empty/invalid missingPackages list is omitted');
    resetMocks();

    const mockNoPkgsJob = {
      jobId: 'PR-NOPKGS-004',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'PREFLIGHT_FAILED',
        details: {
          missingPackages: ['unauthorized_only'],
          stderr: 'ImportError'
        }
      }
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockNoPkgsJob
      }),
      ...mockNoPkgsJob
    });

    detailResult = await jobService.getJobDetail('PR-NOPKGS-004');
    jobDetail = detailResult.job;
    assert.strictEqual(jobDetail.failureDiagnosis.missingPackages, undefined, 'missingPackages must be omitted if empty after filtering');

    // 5. History safely shows validated package names and valid scope only
    console.log('Assertion 8: History safely shows validated package names and scope only');
    resetMocks();

    const mockTimeoutTSS = {
      jobId: 'PR-TIMEOUT-TSS',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'WORKER_TIMEOUT',
        details: { scope: 'TSS' }
      }
    };

    const mockTimeoutInvalid = {
      jobId: 'PR-TIMEOUT-INV',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'WORKER_TIMEOUT',
        details: { scope: 'BAD_SCOPE' }
      }
    };

    const mockPreflightPandas = {
      jobId: 'PR-PREFLIGHT-PANDAS',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'PREFLIGHT_FAILED',
        details: { missingPackages: ['pandas', 'other'] }
      }
    };

    const mockPreflightEmpty = {
      jobId: 'PR-PREFLIGHT-EMPTY',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: {
        code: 'PREFLIGHT_FAILED',
        details: { missingPackages: ['invalid'] }
      }
    };

    const mockJobsList = [
      mockTimeoutTSS,
      mockTimeoutInvalid,
      mockPreflightPandas,
      mockPreflightEmpty
    ];

    Job.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => mockJobsList
          })
        })
      })
    });
    Job.countDocuments = () => mockJobsList.length;

    const listResult = await jobService.listJobs();
    assert.strictEqual(listResult.items.length, 4);

    const histTimeoutTSS = listResult.items.find(item => item.jobId === 'PR-TIMEOUT-TSS');
    const histTimeoutInv = listResult.items.find(item => item.jobId === 'PR-TIMEOUT-INV');
    const histPreflightPandas = listResult.items.find(item => item.jobId === 'PR-PREFLIGHT-PANDAS');
    const histPreflightEmpty = listResult.items.find(item => item.jobId === 'PR-PREFLIGHT-EMPTY');

    assert.strictEqual(histTimeoutTSS.failureSummary, 'PR worker execution timed out (TSS).');
    assert.strictEqual(histTimeoutInv.failureSummary, 'PR worker execution timed out.');
    assert.strictEqual(histPreflightPandas.failureSummary, 'Dependency missing: pandas');
    assert.strictEqual(histPreflightEmpty.failureSummary, 'PR worker dependency check failed.');

    // 6. Successful jobs expose no failureDiagnosis and no raw error
    console.log('Assertion 9: Successful jobs expose no failureDiagnosis or raw error');
    resetMocks();

    const mockSuccessJob = {
      jobId: 'PR-SUCCESS-005',
      workerType: 'pr-worker',
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockSuccessJob
      }),
      ...mockSuccessJob
    });

    detailResult = await jobService.getJobDetail('PR-SUCCESS-005');
    jobDetail = detailResult.job;
    assert.strictEqual(jobDetail.failureDiagnosis, undefined);
    assert.strictEqual(jobDetail.error, undefined);

    // 7. RAN failures are worker-aware and expose only sanitized stage names
    console.log('Assertion 10: RAN failure summaries and diagnosis are stage-aware without leaking paths');
    resetMocks();

    const mockRanProcessFailure = {
      jobId: 'RAN-FAILED-006',
      workerId: 'ran-pr',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: buildRanExecutionError({
        type: 'process_failed',
        stage: 'src\\simple_pr_generator.py',
        exitCode: 9,
        stderr: hostileStderr
      })
    };

    Job.findOne = () => ({
      lean: () => ({
        catch: () => mockRanProcessFailure
      }),
      ...mockRanProcessFailure
    });

    detailResult = await jobService.getJobDetail('RAN-FAILED-006');
    jobDetail = detailResult.job;
    assert.strictEqual(jobDetail.failureSummary, 'RAN PR worker process failed (simple_pr_generator.py).');
    assert.strictEqual(jobDetail.failureDiagnosis.category, 'WORKER_PROCESS_FAILED');
    assert.strictEqual(jobDetail.failureDiagnosis.stage, 'simple_pr_generator.py');
    assert.strictEqual(jobDetail.failureDiagnosis.exitCode, 9);
    assert.strictEqual(jobDetail.failureDiagnosis.summary.includes('src\\simple_pr_generator.py'), false);
    assert.strictEqual(jobDetail.failureDiagnosis.summary.includes('simple_pr_generator.py'), true);
    assert.strictEqual(jobDetail.failureDiagnosis.technicalDetails.includes('C:\\Users\\JJ\\uploads\\site_pr_po_view.xlsx'), false);

    // 8. RAN timeout summaries are rendered in job history with sanitized stage names
    console.log('Assertion 11: RAN timeout history summary uses worker-aware sanitized stage names');
    resetMocks();

    const mockRanTimeout = {
      jobId: 'RAN-TIMEOUT-007',
      workerId: 'ran-pr',
      workerType: 'pr-worker',
      status: 'failed',
      createdAt: new Date().toISOString(),
      error: buildRanExecutionError({
        type: 'timeout',
        stage: 'src/simple_ecc_export.py',
        exitCode: null,
        stderr: ''
      })
    };

    Job.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => [mockRanTimeout]
          })
        })
      })
    });
    Job.countDocuments = () => 1;

    const ranListResult = await jobService.listJobs();
    assert.strictEqual(ranListResult.items[0].failureSummary, 'RAN PR worker execution timed out (simple_ecc_export.py).');

    console.log('--- Hardened Error Visibility and Security Tests Passed! ---');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    resetMocks();
  }
};

runTests();
