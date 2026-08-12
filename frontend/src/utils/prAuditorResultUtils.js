export const isPrAuditorWorker = (workerId) => ['pr-auditor', 'tx-pr-auditor'].includes(workerId);

export const isAuditReport = (file = {}) => (
  file.fileType === 'pr_audit_result_xlsx'
  || /(?:^|[_\s-])audit(?:[_\s-]|.*result).*\.xlsx$/i.test(file.fileName || '')
  || /^PR_Audit_Result\.xlsx$/i.test(file.fileName || '')
);

export const isArchiveOutput = (file = {}) => (
  file.fileType === 'zip_package' || /\.zip$/i.test(file.fileName || '')
);

export const findAvailableAuditReport = (outputs = []) => (
  Array.isArray(outputs)
    ? outputs.find((file) => isAuditReport(file) && file.available) || null
    : null
);

export const findAvailableArchive = (outputs = []) => (
  Array.isArray(outputs)
    ? outputs.find((file) => isArchiveOutput(file) && file.available) || null
    : null
);

export const hasAuditReport = (job = {}, outputs) => {
  if (Array.isArray(outputs)) {
    return Boolean(findAvailableAuditReport(outputs));
  }

  return Number(job.outputFileCount) > 0;
};

export const prAuditorReportMessage = (job = {}, outputs) => {
  if (!hasAuditReport(job, outputs)) {
    return 'No audit report was generated.';
  }

  return 'Audit report generated. Detailed findings are available in the workbook download.';
};
