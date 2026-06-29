const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const config = require('../config/env');

const NORMALIZATION_SHEET = 'Equipment_Normalization';
const BOM_HEADER_ROW_INDEX = 2;
const BOM_DATA_ROW_INDEX = BOM_HEADER_ROW_INDEX + 1;

const cleanText = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\r/g, ' ')
  .replace(/\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

let cachedBomContract = null;

const readWorkbookRows = (workbook, sheetName) => xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
  header: 1,
  defval: '',
  raw: false
});

const readNormalizationColumns = () => {
  const workbook = xlsx.readFile(path.join(config.ranCreatePrCdRoot, 'config', 'MainConfig.xlsx'), {
    cellDates: false,
    raw: false
  });
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[NORMALIZATION_SHEET], {
    defval: '',
    raw: false
  });

  const columns = new Set();
  for (const row of rows) {
    const itemList = cleanText(row['Item List']);
    const itemKey = cleanText(row.ItemKey);
    if (itemList && itemKey) {
      columns.add(itemList);
    }
  }

  return Array.from(columns);
};

const getRanBomContract = async () => {
  if (cachedBomContract) {
    return cachedBomContract;
  }

  const normalizationColumns = readNormalizationColumns();

  cachedBomContract = {
    headerRowIndex: BOM_HEADER_ROW_INDEX,
    minimumDataRowIndex: BOM_DATA_ROW_INDEX,
    requiredColumns: {
      siteCode: 'site code',
      siteName: 'site name',
      region: 'region',
      duCode: 'du code'
    },
    normalizationColumns
  };

  return cachedBomContract;
};

const detectRequiredColumns = (headers) => {
  const normalized = headers.map((header) => cleanText(header).toLowerCase());

  return {
    siteCode: normalized.findIndex((header) => header.includes('site code')),
    siteName: normalized.findIndex((header) => header.includes('site name')),
    region: normalized.findIndex((header) => header === 'region'),
    duCode: normalized.findIndex((header) => header.includes('du code'))
  };
};

const hasMeaningfulBomRow = (rows, requiredIndexes, normalizedHeaders, normalizationSet) => rows
  .slice(BOM_DATA_ROW_INDEX)
  .some((row) => {
    const siteCode = cleanText(row[requiredIndexes.siteCode]);
    const siteName = cleanText(row[requiredIndexes.siteName]);
    const region = cleanText(row[requiredIndexes.region]);
    const duCode = cleanText(row[requiredIndexes.duCode]);

    if (!siteCode || !siteName || !region || !duCode) {
      return false;
    }

    return normalizedHeaders.some((header, index) => {
      if (!normalizationSet.has(header)) {
        return false;
      }

      const value = Number(row[index]);
      return Number.isFinite(value) && value !== 0;
    });
  });

const validateRanBomWorkbookBuffer = async (buffer) => {
  const contract = await getRanBomContract();
  const workbook = xlsx.read(buffer, {
    type: 'buffer',
    cellDates: false,
    raw: false
  });
  const sheetName = workbook.SheetNames[0];
  const rows = readWorkbookRows(workbook, sheetName);
  const headerRow = rows[contract.headerRowIndex] || [];
  const normalizedHeaders = headerRow.map((header) => cleanText(header));
  const requiredIndexes = detectRequiredColumns(normalizedHeaders);
  const matchedNormalizationColumns = normalizedHeaders.filter((header) => (
    contract.normalizationColumns.includes(header)
  ));

  const missingRequiredColumns = Object.entries(requiredIndexes)
    .filter(([, index]) => index < 0)
    .map(([key]) => key);

  const normalizationSet = new Set(contract.normalizationColumns);
  const hasDataRow = rows.length > BOM_DATA_ROW_INDEX;
  const hasMeaningfulRow = hasDataRow
    && missingRequiredColumns.length === 0
    && hasMeaningfulBomRow(rows, requiredIndexes, normalizedHeaders, normalizationSet);

  if (missingRequiredColumns.length > 0 || matchedNormalizationColumns.length === 0 || !hasMeaningfulRow) {
    return {
      valid: false,
      reasonCode: 'RAN_BOM_STRUCTURE_INVALID',
      message: 'Workbook does not match the required RAN BOM structure.',
      details: {
        missingRequiredColumns,
        matchedNormalizationColumnCount: matchedNormalizationColumns.length,
        hasMeaningfulRow
      }
    };
  }

  return {
    valid: true,
    details: {
      matchedNormalizationColumnCount: matchedNormalizationColumns.length
    }
  };
};

module.exports = {
  cleanText,
  getRanBomContract,
  validateRanBomWorkbookBuffer
};
