const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertManifestEngineIntegrity,
  assertPlatformEngineIntegrity,
  computeRuntimeFingerprint,
  resolveGitHead
} = require('../src/services/engineIntegrityService');
const prAuditorManifest = require('../src/workers/manifests/prAuditorManifest');

const runTests = async () => {
  console.log('--- Running Engine Integrity Tests ---');

  const platformResults = assertPlatformEngineIntegrity();
  assert.deepStrictEqual(
    platformResults.map((result) => result.workerId),
    ['mw-pr', 'pr-auditor']
  );
  assert(platformResults.every((result) => result.gitCommitVerified));
  assert.deepStrictEqual(
    prAuditorManifest.runtimeFiles,
    ['config/du_registry.json', 'scripts/audit_final_po.py'],
    'PR Auditor integrity must cover every executable runtime dependency'
  );

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'engine-integrity-'));
  try {
    await fs.promises.mkdir(path.join(tempRoot, 'scripts'), { recursive: true });
    await fs.promises.writeFile(path.join(tempRoot, 'scripts', 'worker.py'), 'print("approved")\n');

    const runtimeFiles = ['scripts/worker.py'];
    const runtimeFingerprint = computeRuntimeFingerprint(tempRoot, runtimeFiles);
    const manifest = {
      workerId: 'test-worker',
      displayName: 'Test Worker',
      engineCommit: '1111111111111111111111111111111111111111',
      runtimeFingerprint,
      runtimeFiles,
      compatibilityStatus: 'verified'
    };

    const fingerprintOnlyResult = assertManifestEngineIntegrity({
      engineRoot: tempRoot,
      manifest
    });
    assert.strictEqual(fingerprintOnlyResult.gitCommitVerified, false);

    await fs.promises.writeFile(path.join(tempRoot, 'scripts', 'worker.py'), 'print("tampered")\n');
    assert.throws(
      () => assertManifestEngineIntegrity({ engineRoot: tempRoot, manifest }),
      (error) => error.code === 'ENGINE_FINGERPRINT_MISMATCH'
    );

    await fs.promises.writeFile(path.join(tempRoot, 'scripts', 'worker.py'), 'print("approved")\n');
    await fs.promises.mkdir(path.join(tempRoot, '.git'), { recursive: true });
    await fs.promises.writeFile(path.join(tempRoot, '.git', 'HEAD'), '2222222222222222222222222222222222222222\n');
    assert.strictEqual(resolveGitHead(tempRoot), '2222222222222222222222222222222222222222');
    assert.throws(
      () => assertManifestEngineIntegrity({ engineRoot: tempRoot, manifest }),
      (error) => error.code === 'ENGINE_COMMIT_MISMATCH'
    );
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }

  console.log('--- Engine Integrity Tests Passed! ---');
};

runTests().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
