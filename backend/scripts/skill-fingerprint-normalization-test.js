const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { calculatePackageFingerprint, listRuntimeFiles } = require('../src/skills/skillPackageService');

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

  const tomlPath = path.join(tempRoot, 'pyproject.toml');
  fs.writeFileSync(tomlPath, '[project]\nversion = "0.1.0"\n', 'utf8');
  const lfToml = calculatePackageFingerprint(tempRoot, ['pyproject.toml']);
  fs.writeFileSync(tomlPath, '[project]\r\nversion = "0.1.0"\r\n', 'utf8');
  assert.strictEqual(calculatePackageFingerprint(tempRoot, ['pyproject.toml']).sha256, lfToml.sha256);

  fs.writeFileSync(textPath, 'print("changed")\r\nprint("second")\r\n', 'utf8');
  const changedTextFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);
  assert.notStrictEqual(changedTextFingerprint.sha256, lfFingerprint.sha256);

  fs.writeFileSync(textPath, 'print("first")\nprint("second")\n', 'utf8');
  fs.writeFileSync(binaryPath, Buffer.from([0, 10, 255]));
  const changedBinaryFingerprint = calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'config/**/*.xls']);
  assert.notStrictEqual(changedBinaryFingerprint.sha256, lfFingerprint.sha256);

  // Simulate access denial deterministically (also when tests run as admin).
  const ignored = path.join(tempRoot, 'runtime', 'jobs');
  const nested = path.join(tempRoot, 'src', 'nested');
  fs.mkdirSync(ignored, { recursive: true });
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'worker.py'), 'print("nested")\n');
  const originalReaddir = fs.readdirSync;
  const denied = (directory) => Object.assign(new Error(`denied: ${directory}`), { code: 'EPERM' });
  try {
    fs.readdirSync = (directory, ...args) => {
      if (path.resolve(directory).startsWith(path.join(tempRoot, 'runtime'))) throw denied(directory);
      return originalReaddir.call(fs, directory, ...args);
    };
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, ['src/**/*.py']), ['src/main.py', 'src/nested/worker.py']);
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, ['src/*.py']), ['src/main.py']);
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, ['src/nested/worker.py']), ['src/nested/worker.py']);
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, ['s*/**/worker.py']), ['src/nested/worker.py']);
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, []), []);
    assert.throws(() => listRuntimeFiles(tempRoot, ['**/*.py']), (error) => error.code === 'EPERM');
    assert.throws(() => listRuntimeFiles(tempRoot, ['runtime/**/*.py']), (error) => error.code === 'EPERM');
    // Duplicate/overlapping globs do not duplicate files or change hashes.
    assert.strictEqual(calculatePackageFingerprint(tempRoot, ['src/**/*.py']).sha256,
      calculatePackageFingerprint(tempRoot, ['src/**/*.py', 'src/main.py']).sha256);
    fs.readdirSync = (directory, ...args) => {
      if (path.resolve(directory) === nested) throw denied(directory);
      return originalReaddir.call(fs, directory, ...args);
    };
    assert.throws(() => calculatePackageFingerprint(tempRoot, ['src/**/*.py']), (error) => error.code === 'EPERM');
    assert.deepStrictEqual(listRuntimeFiles(tempRoot, ['src/*.py']), ['src/main.py']);
  } finally {
    fs.readdirSync = originalReaddir;
  }
  console.log('Fingerprint normalization, approved-path pruning and fail-closed access tests passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
