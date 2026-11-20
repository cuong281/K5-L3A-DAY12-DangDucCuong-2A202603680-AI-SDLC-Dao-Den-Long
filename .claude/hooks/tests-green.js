// Stop hook: the agent may not finish while tests or headless proof cases are red.
// Exit code 2 blocks the stop and feeds stderr back to the agent.
import { spawnSync } from 'node:child_process';

const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', shell: false });
const tests = run(['--test', 'tests/sim.test.js', 'tests/headless.test.js']);
if (tests.status !== 0) {
  process.stderr.write('Tests are failing — fix them before finishing (do NOT weaken tests):\n' + (tests.stdout + tests.stderr).split('\n').filter((l) => /not ok|Error|expected|actual/.test(l)).slice(0, 30).join('\n') + '\n');
  process.exit(2);
}
const proof = run(['tools/proof.js', 'ci-check']);
if (proof.status !== 0) {
  process.stderr.write('Headless proof cases are failing (npm run proof):\n' + proof.stdout.split('\n').filter((l) => /FAIL/.test(l)).join('\n') + '\n');
  process.exit(2);
}
process.exit(0);
