const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');
const { JobFile, ReviewRequiredItem, WarningItem } = require('../models');
const storageService = require('./storageService');

const REVIEW_REQUIRED_RE = /^REVIEW_REQUIRED_TI_.*\.csv$/i;
const DUPLICATES_SKIPPED_RE = /^DUPLICATES_SKIPPED_TI_.*\.csv$/i;

const clean = (value) => String(value || '').trim();

const deterministicId = ({ jobId, kind, sourceFileName, rowIndex, row }) => {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({ jobId, kind, sourceFileName, rowIndex, row }))
    .digest('hex')
    .slice(0, 24);
  return `${kind}_${hash}`;
};

const readCsvRows = (absolutePath) => {
  const workbook = xlsx.readFile(absolutePath, { type: 'file', raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
};

const findSourceFiles = async (jobId, matcher) => {
  const sourceRecords = await JobFile.find({ jobId }).sort({ createdAt: 1 }).lean();
  return sourceRecords
    .filter((file) => matcher.test(file.fileName || ''))
    .map((file) => ({
      ...file,
      absolutePath: path.join(storageService.getStorageRoot(), file.filePath)
    }))
    .filter((file) => fs.existsSync(file.absolutePath));
};

const buildReviewItem = ({ jobId, sourceFileName, rowIndex, row }) => {
  const reason = clean(row.Review_Reason) || 'TI item requires manual review.';
  const siteCode = clean(row.Site_ID);
  const txSow = clean(row.Tx_SOW);
  const subcon = clean(row.SubCon_TI);
  const region = clean(row.Region);
  const sourceScope = clean(row.Source_Scope) || 'TI';

  return {
    _id: deterministicId({ jobId, kind: 'ti_review', sourceFileName, rowIndex, row }),
    jobId,
    siteCode,
    scope: sourceScope,
    subcon,
    issueType: reason,
    severity: 'medium',
    description: [
      reason,
      txSow ? `Tx SOW: ${txSow}` : '',
      region ? `Region: ${region}` : '',
      `Source file: ${sourceFileName}`
    ].filter(Boolean).join(' | '),
    sourceRow: rowIndex + 2,
    sourceFileName,
    sourceType: 'create_pr_cd_ti_review_required',
    sourceData: row
  };
};

const buildDuplicateWarning = ({ jobId, sourceFileName, rowIndex, row }) => {
  const reason = clean(row.Reason) || 'Duplicate TI site skipped.';
  const siteCode = clean(row.Site_ID);
  const existingPr = clean(row.Existing_PR);
  const txSow = clean(row.Tx_SOW);
  const subcon = clean(row.SubCon_TI);
  const region = clean(row.Region);

  return {
    _id: deterministicId({ jobId, kind: 'ti_duplicate', sourceFileName, rowIndex, row }),
    jobId,
    siteCode,
    sourceRow: rowIndex + 2,
    warningType: 'duplicate_ti_site_skipped',
    description: [
      reason,
      existingPr ? `Existing PR: ${existingPr}` : '',
      txSow ? `Tx SOW: ${txSow}` : '',
      subcon ? `SubCon TI: ${subcon}` : '',
      region ? `Region: ${region}` : '',
      `Source file: ${sourceFileName}`
    ].filter(Boolean).join(' | '),
    sourceFileName,
    sourceType: 'create_pr_cd_ti_duplicates_skipped',
    sourceData: row
  };
};

const insertIgnoringExisting = async (Model, items) => {
  let inserted = 0;
  for (const item of items) {
    const existing = await Model.findOne({ jobId: item.jobId, _id: item._id });
    if (!existing) {
      await Model.create(item);
      inserted += 1;
    }
  }
  return inserted;
};

const ingestTiResultFiles = async (jobId) => {
  const [reviewFiles, duplicateFiles] = await Promise.all([
    findSourceFiles(jobId, REVIEW_REQUIRED_RE),
    findSourceFiles(jobId, DUPLICATES_SKIPPED_RE)
  ]);

  const reviewItems = [];
  for (const file of reviewFiles) {
    readCsvRows(file.absolutePath).forEach((row, rowIndex) => {
      reviewItems.push(buildReviewItem({ jobId, sourceFileName: file.fileName, rowIndex, row }));
    });
  }

  const warningItems = [];
  for (const file of duplicateFiles) {
    readCsvRows(file.absolutePath).forEach((row, rowIndex) => {
      warningItems.push(buildDuplicateWarning({ jobId, sourceFileName: file.fileName, rowIndex, row }));
    });
  }

  const [insertedReviewRequiredCount, insertedWarningCount] = await Promise.all([
    insertIgnoringExisting(ReviewRequiredItem, reviewItems),
    insertIgnoringExisting(WarningItem, warningItems)
  ]);

  return {
    sourceReviewFileCount: reviewFiles.length,
    sourceDuplicateFileCount: duplicateFiles.length,
    parsedReviewRequiredCount: reviewItems.length,
    parsedWarningCount: warningItems.length,
    insertedReviewRequiredCount,
    insertedWarningCount
  };
};

module.exports = {
  DUPLICATES_SKIPPED_RE,
  REVIEW_REQUIRED_RE,
  ingestTiResultFiles
};
