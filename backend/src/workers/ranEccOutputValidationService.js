const path = require('path');
const xlsx = require('xlsx');
const config = require('../config/env');

let cachedContract = null;

const cleanText = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\r/g, ' ')
  .replace(/\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getRanEccWorkbookContract = async () => {
  if (cachedContract) {
    return cachedContract;
  }

  const samplePath = path.join(config.ranCreatePrCdRoot, 'output', 'ECC_PR_Output.xlsx');
  const workbook = xlsx.readFile(samplePath, {
    cellDates: false,
    raw: false
  });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false
  });
  const requiredHeaders = (rows[0] || []).map((header) => cleanText(header)).filter(Boolean);

  cachedContract = {
    sheetName,
    requiredHeaders,
    meaningfulColumns: ['Site ID*', 'PBOM Code*', 'Quantity*']
  };

  return cachedContract;
};

const buildInvalidResult = (message, details = {}) => ({
  valid: false,
  reasonCode: 'RAN_INVALID_ECC_OUTPUT',
  message,
  details,
  meaningfulRowCount: 0
});

const validateRanEccWorkbook = async ({ workbookPath, trackedFileType }) => {
  const contract = await getRanEccWorkbookContract();
  const workbook = xlsx.readFile(workbookPath, {
    cellDates: false,
    raw: false
  });

  if (!workbook.SheetNames.includes(contract.sheetName)) {
    return buildInvalidResult('Workbook does not contain the required ECC sheet.', {
      trackedFileType,
      expectedSheetName: contract.sheetName
    });
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[contract.sheetName], {
    header: 1,
    defval: '',
    raw: false
  });
  const actualHeaders = (rows[0] || []).map((header) => cleanText(header)).filter(Boolean);

  if (JSON.stringify(actualHeaders) !== JSON.stringify(contract.requiredHeaders)) {
    return buildInvalidResult('Workbook does not contain the required ECC headers.', {
      trackedFileType,
      expectedSheetName: contract.sheetName
    });
  }

  const headerIndexes = Object.fromEntries(contract.requiredHeaders.map((header, index) => [header, index]));
  const meaningfulRowCount = rows
    .slice(1)
    .filter((row) => {
      const siteId = cleanText(row[headerIndexes['Site ID*']]);
      const pbomCode = cleanText(row[headerIndexes['PBOM Code*']]);
      const quantityValue = Number(row[headerIndexes['Quantity*']]);
      return siteId && pbomCode && Number.isFinite(quantityValue) && quantityValue > 0;
    })
    .length;

  if (meaningfulRowCount === 0) {
    return buildInvalidResult('Workbook does not contain any usable ECC data rows.', {
      trackedFileType,
      expectedSheetName: contract.sheetName
    });
  }

  return {
    valid: true,
    reasonCode: null,
    message: '',
    details: {
      trackedFileType,
      expectedSheetName: contract.sheetName
    },
    meaningfulRowCount
  };
};

module.exports = {
  getRanEccWorkbookContract,
  validateRanEccWorkbook
};
