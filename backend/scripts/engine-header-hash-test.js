const assert = require('assert');
const xlsx = require('xlsx');
const {
  buildHeaderInventory,
  calculateHeaderHash,
  inspectWorkbookHeader,
  normalizeHeaderValue
} = require('../src/services/engineHeaderHashService');
const { parseIepmsWorkbook } = require('../src/services/iepmsParser');

const EXPECTED_COMPLETE_HASH = '3f69c9eb2db0345dfdb3bb48ec2ad4f7bebdc865c8e827de30178c8724aa21a2';
const EXPECTED_DATA_ONLY_HASH = 'd24ee36e8e3207cd04097099a904d05bb10e19d183a3b60563f2a18fc2c6cf1b';

const createWorkbook = ({ includeDropDown }) => {
  const workbook = xlsx.utils.book_new();
  const dataRows = [
    ['site|fix00012|4188808420049567786|2477626672974883536', 'docata|ZDCSZ00815532'],
    ['Site Basic Info', 'Installation'],
    ['Site Basic Info', 'Microwave'],
    ['customer\u00a0 site   code', 'Tx SOW'],
    ['B00001', 'New Link']
  ];
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(dataRows), 'data');

  if (includeDropDown) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['drop|one', 'drop|two'],
      ['Reference', 'Reference'],
      ['Options', 'Options'],
      ['First Option', 'Second Option']
    ]), 'drop_down');
  }

  return workbook;
};

const run = () => {
  assert.strictEqual(
    normalizeHeaderValue(' customer\u00a0 site   code '),
    'customer site code',
    'normalization must match create-pr-cd'
  );

  const completeWorkbook = createWorkbook({ includeDropDown: true });
  const dataOnlyWorkbook = createWorkbook({ includeDropDown: false });
  const completeHash = calculateHeaderHash(buildHeaderInventory(completeWorkbook));
  const dataOnlyHash = calculateHeaderHash(buildHeaderInventory(dataOnlyWorkbook));

  assert.strictEqual(completeHash, EXPECTED_COMPLETE_HASH);
  assert.strictEqual(dataOnlyHash, EXPECTED_DATA_ONLY_HASH);
  assert.notStrictEqual(
    completeHash,
    dataOnlyHash,
    'removing a worksheet must change the engine-compatible header hash'
  );

  const inspection = inspectWorkbookHeader(completeWorkbook);
  assert.deepStrictEqual(inspection.sheets, [
    { sheetName: 'data', headerColumnCount: 2 },
    { sheetName: 'drop_down', headerColumnCount: 2 }
  ]);

  const buffer = xlsx.write(completeWorkbook, { type: 'buffer', bookType: 'xlsx' });
  const parsedWorkbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const roundTripHash = calculateHeaderHash(buildHeaderInventory(parsedWorkbook));
  assert.strictEqual(roundTripHash, EXPECTED_COMPLETE_HASH);

  // Verify the public parser carries the same diagnostic metadata.
  const tempPath = require('path').join(
    require('os').tmpdir(),
    `engine-header-hash-${process.pid}-${Date.now()}.xlsx`
  );
  require('fs').writeFileSync(tempPath, buffer);
  try {
    const parsed = parseIepmsWorkbook(tempPath);
    assert.strictEqual(parsed.metadata.headerHash, EXPECTED_COMPLETE_HASH);
    assert.strictEqual(parsed.metadata.headerRowCount, 4);
  } finally {
    require('fs').unlinkSync(tempPath);
  }

  console.log('Engine-compatible header hash tests passed.');
};

run();
