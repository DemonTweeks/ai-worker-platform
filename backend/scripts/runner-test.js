const path = require('path');
const { runCommand } = require('../src/services/childProcessRunner');

const run = async () => {
  try {
    console.log('TEST: Python prints checkmark (should succeed with PYTHONUTF8 enforced)');
    const res1 = await runCommand({ command: 'python', args: ['-c', 'print("✓")'], cwd: process.cwd(), timeoutMs: 10000 });
    console.log('exitCode:', res1.exitCode);
    console.log('stdout snippet:', res1.stdout.slice(0, 200));

    console.log('\nTEST: Python exits with non-zero (simulate crash)');
    const res2 = await runCommand({ command: 'python', args: ['-c', 'import sys; sys.exit(2)'], cwd: process.cwd(), timeoutMs: 10000 });
    console.log('exitCode:', res2.exitCode);
    console.log('stderr snippet:', res2.stderr.slice(0, 200));

    process.exit(0);
  } catch (err) {
    console.error('Test runner error:', err);
    process.exit(2);
  }
};

run();
