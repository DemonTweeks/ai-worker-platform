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
const { loadApprovedSkill } = require('../src/skills/skillPackageService');

const runTests = async () => {
  console.log('--- Running Engine Integrity Tests ---');

  const platformResults = assertPlatformEngineIntegrity();
  assert.deepStrictEqual(
    platformResults.map((result) => result.workerId),
    ['create-pr-cd', 'tx-pr-auditor', 'create-pr-cd-ran', 'bom-builder']
  );
  assert(platformResults.every((result) => /^[a-f0-9]{64}$/.test(result.runtimeFingerprint)));
  assert(loadApprovedSkill('create-pr-cd').runtimeFiles.includes('src/main.py'));
  assert(loadApprovedSkill('create-pr-cd').runtimeFiles.includes('config/pr_model_baseline.yaml'));
  assert(loadApprovedSkill('tx-pr-auditor').runtimeFiles.includes('config/du_registry.json'));
  assert(loadApprovedSkill('create-pr-cd-ran').runtimeFiles.includes('src/main.py'));
  assert(loadApprovedSkill('bom-builder').runtimeFiles.includes('src/main.py'));

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
