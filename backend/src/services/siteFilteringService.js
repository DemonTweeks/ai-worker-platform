const xlsx = require('xlsx');
const storageService = require('./storageService');
const { WarningItem } = require('../models');
const { parseSiteCodes } = require('./siteCodeParser');

const writeFilteredWorkbook = async ({ jobId, parsedWorkbook, filteredRows }) => {
  const outputRows = [
    ...parsedWorkbook.rows.slice(0, parsedWorkbook.headerRowIndex + 1),
    ...filteredRows.map((row) => row.raw)
  ];
  const filteredWorkbook = xlsx.utils.book_new();
  const filteredSheet = xlsx.utils.aoa_to_sheet(outputRows);
  xlsx.utils.book_append_sheet(filteredWorkbook, filteredSheet, parsedWorkbook.sheetName);

  const buffer = xlsx.write(filteredWorkbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });
  const filePath = storageService.resolveJobFilePath(jobId, 'filtered', 'filtered_site_pr_po_view.xlsx');
  return storageService.saveBufferToFile(filePath, buffer);
};

const createDuplicateWarnings = async (jobId, duplicateSiteCodes) => {
  if (!duplicateSiteCodes.length) {
    return [];
  }

  return WarningItem.insertMany(duplicateSiteCodes.map((siteCode) => ({
    jobId,
    warningType: 'DUPLICATE_SITE_CODE_INPUT',
    siteCode,
    description: 'Duplicate site code was provided and processed once only.'
  })));
};

const createUnmatchedWarnings = async (jobId, unmatchedSiteCodes) => {
  if (!unmatchedSiteCodes.length) {
    return [];
  }

  return WarningItem.insertMany(unmatchedSiteCodes.map((siteCode) => ({
    jobId,
    warningType: 'UNMATCHED_SITE_CODE',
    siteCode,
    description: 'Requested site code was not found in the uploaded iEPMS export.'
  })));
};

const filterSites = async ({ jobId, parsedWorkbook, generationScope, siteCodes }) => {
  let filteredRows = parsedWorkbook.structuredRows;
  let matchedSiteCount = 0;
  let matchedSiteCodes = [];
  let unmatchedSiteCodes = [];
  const parsedSiteCodes = parseSiteCodes(siteCodes);

  await createDuplicateWarnings(jobId, parsedSiteCodes.duplicateSiteCodes);

  if (generationScope === 'site_code') {
    const requestedSet = new Set(parsedSiteCodes.siteCodes);
    filteredRows = parsedWorkbook.structuredRows.filter((row) => requestedSet.has(row.siteCode));
    const matchedSet = new Set(filteredRows.map((row) => row.siteCode));
    matchedSiteCodes = parsedSiteCodes.siteCodes.filter((siteCode) => matchedSet.has(siteCode));
    unmatchedSiteCodes = parsedSiteCodes.siteCodes.filter((siteCode) => !matchedSet.has(siteCode));
    matchedSiteCount = matchedSet.size;
    await createUnmatchedWarnings(jobId, unmatchedSiteCodes);
  } else {
    // Eligibility is owned by create-pr-cd. EPIC 5 passes all parsed rows for all_sites.
    matchedSiteCount = new Set(parsedWorkbook.structuredRows.map((row) => row.siteCode).filter(Boolean)).size;
  }

  const filteredMetadata = await writeFilteredWorkbook({ jobId, parsedWorkbook, filteredRows });

  return {
    filteredMetadata,
    filteredRows,
    duplicateSiteCodes: parsedSiteCodes.duplicateSiteCodes,
    unmatchedSiteCodes,
    matchedSiteCodes,
    matchedSiteCount,
    unmatchedSiteCount: unmatchedSiteCodes.length,
    requestedSiteCount: generationScope === 'site_code' ? parsedSiteCodes.siteCodes.length : matchedSiteCount
  };
};

module.exports = {
  filterSites
};
