const { normalizeResultReconciliation } = require('./resultReconciliationService');

const getNoEccExplanation = (summary) => {
  if ((summary.outputFileCount || 0) > 0 || (summary.matchedSiteCount || 0) === 0) {
    return '';
  }

  const parts = [];
  if ((summary.reviewRequiredCount || 0) > 0) {
    parts.push(`${summary.reviewRequiredCount} review-required item(s)`);
  }
  if ((summary.warningCount || 0) > 0) {
    parts.push(`${summary.warningCount} warning item(s)`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `No ECC files were generated because create-pr-cd produced ${parts.join(' and ')} for the matched TI site(s).`;
};

const determineFinalStatus = (summary) => {
  const reconciliation = normalizeResultReconciliation(summary);

  if (reconciliation) {
    if (reconciliation.reconciliationConsistent === false || (reconciliation.unaccountedSiteCount || 0) > 0) {
      throw Object.assign(
        new Error(
          `${reconciliation.generatedSiteCount} of ${reconciliation.requestedSiteCount} requested sites generated. `
          + `${reconciliation.unaccountedSiteCount || 0} sites have no confirmed result.`
        ),
        {
          code: 'RESULT_RECONCILIATION_INCOMPLETE',
          details: reconciliation
        }
      );
    }

    if ((reconciliation.generatedSiteCount || 0) > 0 && (summary.outputFileCount || 0) === 0) {
      throw Object.assign(
        new Error('Result reconciliation reports generated sites, but no ECC output files were collected.'),
        {
          code: 'ZERO_OUTPUT_WITHOUT_EXPLANATION',
          details: {
            matchedSiteCount: summary.matchedSiteCount || 0,
            outputFileCount: summary.outputFileCount || 0,
            reviewRequiredCount: summary.reviewRequiredCount || 0,
            warningCount: summary.warningCount || 0,
            generatedSiteCount: reconciliation.generatedSiteCount,
            reviewRequiredSiteCount: reconciliation.reviewRequiredSiteCount,
            approvedIgnoredSiteCount: reconciliation.approvedIgnoredSiteCount,
            duplicateBlockedSiteCount: reconciliation.duplicateBlockedSiteCount,
            failedSiteCount: reconciliation.failedSiteCount
          }
        }
      );
    }

    if ((reconciliation.generatedSiteCount || 0) === 0 && (summary.outputFileCount || 0) > 0) {
      throw Object.assign(
        new Error('ECC output files were collected even though result reconciliation reports zero generated sites.'),
        {
          code: 'RESULT_RECONCILIATION_INCOMPLETE',
          details: {
            ...reconciliation,
            outputFileCount: summary.outputFileCount || 0
          }
        }
      );
    }

    const hasNonGeneratedDisposition = (
      (reconciliation.reviewRequiredSiteCount || 0) > 0
      || (reconciliation.approvedIgnoredSiteCount || 0) > 0
      || (reconciliation.duplicateBlockedSiteCount || 0) > 0
      || (reconciliation.failedSiteCount || 0) > 0
    );

    if (hasNonGeneratedDisposition) {
      return 'completed_with_warning';
    }
  }

  if ((summary.matchedSiteCount || 0) > 0 && (summary.outputFileCount || 0) === 0) {
    if ((summary.reviewRequiredCount || 0) > 0 || (summary.warningCount || 0) > 0) {
      return 'completed_with_warning';
    }

    throw Object.assign(
      new Error('No ECC files were generated for matched sites, and create-pr-cd did not provide review-required or warning records to explain the zero-output result.'),
      {
        code: 'ZERO_OUTPUT_WITHOUT_EXPLANATION',
        details: {
          matchedSiteCount: summary.matchedSiteCount || 0,
          outputFileCount: summary.outputFileCount || 0,
          reviewRequiredCount: summary.reviewRequiredCount || 0,
          warningCount: summary.warningCount || 0
        }
      }
    );
  }

  return (summary.warningCount || 0) > 0 || (summary.reviewRequiredCount || 0) > 0
    ? 'completed_with_warning'
    : 'completed';
};

module.exports = {
  determineFinalStatus,
  getNoEccExplanation
};
