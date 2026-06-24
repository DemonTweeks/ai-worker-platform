const hasValue = (value) => value !== undefined && value !== null && value !== '';

const safePathTail = (value, segments = 2) => {
  if (!hasValue(value)) return '';
  const parts = String(value).split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.slice(-segments).join('/');
};

const buildTechnicalDetail = (label, value) => (
  hasValue(value) ? { label, value: String(value) } : null
);

export const isRequestTimeoutError = (error) => Boolean(
  error && (
    error.code === 'ECONNABORTED'
    || String(error.message || '').toLowerCase().includes('timeout')
  )
);

export const getRequestTimeoutBanner = () => ({
  id: `timeout-${Date.now()}`,
  message: 'Request timed out. The job may still be running. Please check History.',
  dismissible: true,
  autoDismissMs: 7000,
  tone: 'warning'
});

export const getJobErrorPresentation = (job) => {
  if (!job || !job.error || !job.error.message) {
    return null;
  }

  const error = job.error;
  const details = error.details || {};
  const missingPackages = Array.isArray(details.missingPackages)
    ? details.missingPackages.map((item) => String(item)).filter(Boolean)
    : [];
  const interpreter = details.actualPythonExecutable || details.pythonExecutable || '';
  const requestedInterpreter = details.pythonExecutable || '';
  const technicalDetails = [];
  const isDependencyMissing = error.code === 'WORKER_DEPENDENCY_MISSING';

  if (isDependencyMissing) {
    technicalDetails.push(
      buildTechnicalDetail('Error code', error.code),
      buildTechnicalDetail('Worker scope', details.scope),
      buildTechnicalDetail('Requested interpreter', requestedInterpreter && requestedInterpreter !== interpreter ? requestedInterpreter : ''),
      buildTechnicalDetail('Business script', safePathTail(details.resolvedSkillPath, 1)),
      buildTechnicalDetail('Working directory', safePathTail(details.workingDirectory))
    );

    return {
      summary: missingPackages.length > 0
        ? `Python worker dependencies missing: ${missingPackages.join(', ')}.`
        : error.message,
      rootCause: missingPackages.length > 0 ? missingPackages.join(', ') : 'Missing worker dependency',
      interpreter,
      repairCommand: details.recommendedFixCommand || '',
      technicalDetails: technicalDetails.filter(Boolean),
      tone: 'danger',
      isDependencyMissing: true
    };
  }

  technicalDetails.push(
    buildTechnicalDetail('Error code', error.code),
    buildTechnicalDetail('Worker scope', details.scope),
    buildTechnicalDetail('Interpreter', interpreter),
    buildTechnicalDetail('Business script', safePathTail(details.resolvedSkillPath, 1)),
    buildTechnicalDetail('Working directory', safePathTail(details.workingDirectory))
  );

  return {
    summary: error.message,
    rootCause: error.failureType || error.code || 'Worker failure',
    interpreter,
    repairCommand: '',
    technicalDetails: technicalDetails.filter(Boolean),
    tone: 'danger',
    isDependencyMissing: false
  };
};
