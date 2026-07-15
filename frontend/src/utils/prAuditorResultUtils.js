export const findAvailableAuditReport = (outputs = []) => (
  Array.isArray(outputs)
    ? outputs.find((file) => file.fileType === 'pr_audit_result_xlsx' && file.available) || null
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
