const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { calculatePackageFingerprint } = require('../src/skills/skillPackageService');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-worker-skill-fingerprint-'));

try {
  const textPath = path.join(tempRoot, 'src', 'main.py');
  const binaryPath = path.join(tempRoot, 'config', 'template.xls');
  fs.mkdirSync(path.dirname(textPath), { recursive: true });
  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
  fs.writeFileSync(binaryPath, Buffer.from([0, 13, 10, 255]));

  fs.writeFileSync(textPath, 'print("first")\nprint("second")\n', 'utf8');
  const lfFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);

  fs.writeFileSync(textPath, 'print("first")\r\nprint("second")\r\n', 'utf8');
  const crlfFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);
  assert.strictEqual(crlfFingerprint.sha256, lfFingerprint.sha256);

  fs.writeFileSync(textPath, 'print("changed")\r\nprint("second")\r\n', 'utf8');
  const changedTextFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);
  assert.notStrictEqual(changedTextFingerprint.sha256, lfFingerprint.sha256);

  fs.writeFileSync(textPath, 'print("first")\nprint("second")\n', 'utf8');
  fs.writeFileSync(binaryPath, Buffer.from([0, 10, 255]));
  const changedBinaryFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);
  assert.notStrictEqual(changedBinaryFingerprint.sha256, lfFingerprint.sha256);

  console.log('Cross-platform skill fingerprint normalization tests passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
