const xlsx = require('xlsx');
const config = require('../config/env');
const { createApiError } = require('../utils/apiError');

const SITE_CODE_CANDIDATES = [
  'customer site code',
  'site id',
  'site id*',
  'site code',
  'site_code'
];

const normalizeColumnName = (value) => String(value || '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const findHeaderRowIndex = (rows) => {
  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const normalized = rows[index].map(normalizeColumnName);
    if (normalized.some((value) => SITE_CODE_CANDIDATES.includes(value))) {
      return index;
    }
  }

  return -1;
};

const findSiteCodeColumn = (headers) => {
  const normalizedHeaders = headers.map(normalizeColumnName);

  for (const candidate of SITE_CODE_CANDIDATES) {
    const index = normalizedHeaders.indexOf(candidate);
    if (index !== -1) {
      return {
        index,
        name: headers[index],
        normalizedName: normalizedHeaders[index]
      };
    }
  }

  return null;
};

const parseIepmsWorkbookObject = (workbook) => {
  const sheetName = workbook.SheetNames.includes('data') ? 'data' : workbook.SheetNames[0];

  if (!sheetName) {
    throw createApiError(400, 'INVALID_WORKBOOK', 'Workbook does not contain any sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headerRowIndex = findHeaderRowIndex(rows);

  if (headerRowIndex === -1) {
    throw createApiError(400, 'MISSING_SITE_CODE_COLUMN', 'Site code column could not be detected.');
  }

  const headers = rows[headerRowIndex].map((header) => String(header || '').trim());
  const siteCodeColumn = findSiteCodeColumn(headers);

  if (!siteCodeColumn) {
    throw createApiError(400, 'MISSING_SITE_CODE_COLUMN', 'Site code column could not be detected.');
  }

  const dataRows = rows.slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''));

  if (dataRows.length > config.limits.maxRowCount) {
    throw createApiError(
      400,
      'ROW_LIMIT_EXCEEDED',
      `Uploaded workbook has ${dataRows.length} rows, exceeding the configured limit of ${config.limits.maxRowCount}.`
    );
  }

  const structuredRows = dataRows.map((row, rowIndex) => {
    const values = {};
    headers.forEach((header, index) => {
      values[normalizeColumnName(header)] = row[index];
    });

    const siteCode = String(row[siteCodeColumn.index] || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toUpperCase();

    return {
      sourceRow: headerRowIndex + rowIndex + 2,
      raw: row,
      values,
      siteCode
    };
  });

  return {
    workbook,
    sheetName,
    rows,
    headerRowIndex,
    headers,
    siteCodeColumn,
    dataRows,
    structuredRows,
    rowCount: structuredRows.length,
    metadata: {
      sheetName,
      sheetNames: workbook.SheetNames,
      rowCount: structuredRows.length,
      siteCodeColumn: siteCodeColumn.name
    }
  };
};

const parseIepmsWorkbook = (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  return parseIepmsWorkbookObject(workbook);
};

const inspectIepmsWorkbookBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const parsed = parseIepmsWorkbookObject(workbook);

  return {
    sheetName: parsed.sheetName,
    sheetNames: parsed.metadata.sheetNames,
    rowCount: parsed.rowCount,
    siteCodeColumn: parsed.metadata.siteCodeColumn
  };
};

module.exports = {
  findHeaderRowIndex,
  inspectIepmsWorkbookBuffer,
  normalizeColumnName,
  parseIepmsWorkbook
};
