const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const xlsx = require('xlsx');

const {
  validateRanEccWorkbook,
  getRanEccWorkbookContract
} = require('../src/workers/ranEccOutputValidationService');

const repoRoot = path.resolve(__dirname, '../..');
const ranSkillRoot = path.join(repoRoot, 'skills', 'create-pr-cd-ran');
const validOutputPath = path.join(ranSkillRoot, 'output', 'ECC_PR_Output.xlsx');

const createWorkbook = ({ sheetName, rows }) => {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
};

const writeTempWorkbook = async ({ sheetName, rows }) => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ran-ecc-output-'));
  const filePath = path.join(tempRoot, 'output.xlsx');
  const workbook = createWorkbook({ sheetName, rows });
  xlsx.writeFile(workbook, filePath);
  return {
    filePath,
    cleanup: async () => fs.promises.rm(tempRoot, { recursive: true, force: true })
  };
};

const main = async () => {
  const contract = await getRanEccWorkbookContract();
  assert.strictEqual(contract.sheetName, 'ECC_PR', 'contract should resolve the ECC_PR sheet from the pinned engine sample');
  assert(contract.requiredHeaders.includes('PBOM Code*'), 'contract should require PBOM Code*');
  assert(contract.requiredHeaders.includes('Quantity*'), 'contract should require Quantity*');

  const validResult = await validateRanEccWorkbook({
    workbookPath: validOutputPath,
    trackedFileType: 'ran_ecc_output'
  });
  assert.strictEqual(validResult.valid, true, 'pinned upstream ECC output sample should validate');
  assert(validResult.meaningfulRowCount > 0, 'pinned upstream ECC output sample should contain meaningful ECC rows');

  const placeholder = await writeTempWorkbook({
    sheetName: 'ECC_PR',
    rows: [['']]
  });

  try {
    const placeholderResult = await validateRanEccWorkbook({
      workbookPath: placeholder.filePath,
      trackedFileType: 'ran_ecc_output'
    });
    assert.strictEqual(placeholderResult.valid, false, 'placeholder one-cell workbook must not validate as ECC output');
    assert.strictEqual(
      placeholderResult.reasonCode,
      'RAN_INVALID_ECC_OUTPUT',
      'placeholder one-cell workbook should surface the invalid ECC output reason'
    );
  } finally {
    await placeholder.cleanup();
  }

  console.log('--- RAN ECC Output Validation Tests Passed! ---');
};

main().then(() => process.exit(0)).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
