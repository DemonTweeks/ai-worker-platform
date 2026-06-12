const { runCommand } = require('../src/services/childProcessRunner');

(async () => {
  try {
    console.log('ENCODING REGRESSION TEST: child prints a non-ASCII char (checkmark)');
    const res = await runCommand({ command: 'python', args: ['-c', 'print("✓")'], cwd: process.cwd(), timeoutMs: 10000 });
    console.log('exitCode:', res.exitCode);
    console.log('stdout snippet:', res.stdout && res.stdout.slice(0, 200));

    if (res.exitCode !== 0) {
      console.error('Unexpected non-zero exit from checkmark print test');
      process.exit(2);
    }

    console.log('\nENCODING REGRESSION TEST: child exits non-zero to simulate crash');
    const res2 = await runCommand({ command: 'python', args: ['-c', 'import sys; sys.exit(5)'], cwd: process.cwd(), timeoutMs: 10000 });
    console.log('exitCode:', res2.exitCode);
    console.log('stderr snippet:', res2.stderr && res2.stderr.slice(0, 200));

    if (res2.exitCode !== 5) {
      console.error('Unexpected exit code from simulated crash test');
      process.exit(3);
    }

    console.log('\nEncoding regression tests passed (child runner handled non-ASCII print and non-zero exit).');
    process.exit(0);
  } catch (err) {
    console.error('Encoding regression test failed:', err);
    process.exit(4);
  }
})();