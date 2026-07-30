const crypto = require('crypto');
const xlsx = require('xlsx');

const HEADER_ROW_COUNT = 4;
const SCHEMA_VERSION = '1.0';

const normalizeHeaderValue = (value) => {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return String(value)
    .replace(/\u00A0/g, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ');
};

const readCellValue = (cell) => {
  if (!cell) {
    return null;
  }

  // openpyxl is called with data_only=False by create-pr-cd, so formulas are
  // represented by the formula itself rather than by their cached result.
  if (cell.f) {
    return `=${cell.f}`;
  }

  return cell.v;
};

const buildSheetHeaderInventory = (sheetName, worksheet) => {
  if (!worksheet || !worksheet['!ref']) {
    return {
      sheet_name: sheetName,
      header_row_count: HEADER_ROW_COUNT,
      columns: []
    };
  }

  const range = xlsx.utils.decode_range(worksheet['!ref']);
  const columns = [];

  for (let columnIndex = 0; columnIndex <= range.e.c; columnIndex += 1) {
    const normalized = [];

    for (let rowIndex = 0; rowIndex < HEADER_ROW_COUNT; rowIndex += 1) {
      const address = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
      normalized.push(normalizeHeaderValue(readCellValue(worksheet[address])));
    }

    if (!normalized.some(Boolean)) {
      continue;
    }

    columns.push({
      source_position: {
        excel_column: xlsx.utils.encode_col(columnIndex),
        one_based_index: columnIndex + 1
      },
      fingerprint: {
        field_code: normalized[0],
        wbs_stage: normalized[1],
        task_name: normalized[2],
        display_header: normalized[3]
      }
    });
  }

  return {
    sheet_name: sheetName,
    header_row_count: HEADER_ROW_COUNT,
    columns
  };
};

const buildHeaderInventory = (workbook) => ({
  schema_version: SCHEMA_VERSION,
  sheets: workbook.SheetNames.map((sheetName) => (
    buildSheetHeaderInventory(sheetName, workbook.Sheets[sheetName])
  ))
});

const buildHashPayload = (inventory) => ({
  // Property order mirrors Python json.dumps(..., sort_keys=True).
  header_row_count: HEADER_ROW_COUNT,
  schema_version: inventory.schema_version || SCHEMA_VERSION,
  sheets: (inventory.sheets || []).map((sheet) => ({
    columns: (sheet.columns || []).map((column) => ({
      display_header: column.fingerprint.display_header,
      field_code: column.fingerprint.field_code,
      task_name: column.fingerprint.task_name,
      wbs_stage: column.fingerprint.wbs_stage
    })),
    sheet_name: sheet.sheet_name
  }))
});

const calculateHeaderHash = (inventory) => {
  const canonical = JSON.stringify(buildHashPayload(inventory));
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
};

const inspectWorkbookHeader = (workbook) => {
  const inventory = buildHeaderInventory(workbook);

  return {
    headerHash: calculateHeaderHash(inventory),
    headerRowCount: HEADER_ROW_COUNT,
    sheets: inventory.sheets.map((sheet) => ({
      sheetName: sheet.sheet_name,
      headerColumnCount: sheet.columns.length
    }))
  };
};

module.exports = {
  HEADER_ROW_COUNT,
  SCHEMA_VERSION,
  buildHeaderInventory,
  calculateHeaderHash,
  inspectWorkbookHeader,
  normalizeHeaderValue
};
