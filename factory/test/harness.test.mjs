import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = fileURLToPath(new URL('../../', import.meta.url));
const fakeCommand = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.CALLS;
const calls = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse) : [];
const args = process.argv.slice(2);
const pi = path.basename(process.argv[1]) === 'pi';
const role = pi ? (args.includes('read,edit,write,grep,find,ls') ? 'driver' : 'navigator') : args[0] === 'test' ? 'tests' : 'eslint';
const count = calls.filter(call => call.role === role).length + 1;
const input = pi ? fs.readFileSync(0, 'utf8') : '';
fs.appendFileSync(file, JSON.stringify({ role, args, cwd: process.cwd(), input }) + '\\n');
const scenario = process.env.SCENARIO;
if (role === 'tests') {
  const status = Number(process.env.TEST_EXIT);
  console.log(status ? 'Tests failed.' : 'Tests passed.');
  console.error('Test diagnostic.');
  process.exit(status);
}
if (role === 'eslint') {
  if (args.join(' ') !== 'exec --no -- eslint src --no-inline-config') process.exit(99);
  if (scenario === 'eslint-error' || (scenario === 'later-eslint-error' && count > 1)) {
    console.error('ESLint could not load its configuration.'); process.exit(2);
  }
  const passed = scenario === 'clean' || (scenario !== 'fail' && count > (scenario === 'fail-pass' ? 2 : 1));
  console.log(passed ? 'No ESLint findings.' : 'src/index.ts: complexity exceeds 5.');
  process.exit(passed ? 0 : 1);
}
if (role === 'navigator') {
  console.log('Extract a named helper. Plan ' + count + '.');
  console.error('Navigator diagnostic.');
} else {
  fs.appendFileSync('src/index.ts', '\\n// edit ' + count + '\\n');
  console.log('Everything passes.');
}
if (scenario === role + '-signal') process.kill(process.pid, 'SIGTERM');
process.exit(scenario === role + '-error' ? 7 : 0);
`;

function fixture(t, env = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ralph-harness-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const callsFile = join(root, 'calls.jsonl');
  mkdirSync(bin);
  const put = (file, text) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), text);
  };
  for (const file of ['factory/src/run.mjs', 'factory/src/navigator.md', 'factory/src/driver.md']) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    copyFileSync(join(project, file), join(repo, file));
  }
  put('calculator/src/index.ts', 'export const calculate = () => 42;\n');
  for (const name of ['pi', 'npm']) {
    writeFileSync(join(bin, name), fakeCommand);
    chmodSync(join(bin, name), 0o755);
  }
  const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALLS: callsFile, SCENARIO: 'pass', TEST_EXIT: '0', ...env };
  return {
    repo, put,
    run(args = []) {
      return spawnSync(process.execPath, [join(repo, 'factory/src/run.mjs'), ...args], { cwd: root, env: environment, encoding: 'utf8', timeout: 10000 });
    },
    read(file) { return readFileSync(join(repo, file), 'utf8'); },
    calls(role) {
      const calls = readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
      return role ? calls.filter(call => call.role === role) : calls;
    },
  };
}

function exits(result, status) {
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}\n${result.error || ''}`);
}

test('checks, plans, implements, and stops when tests and ESLint both pass', t => {
  const f = fixture(t);
  exits(f.run(['1']), 0);
  assert.deepEqual(f.calls().map(call => call.role), ['tests', 'eslint', 'navigator', 'driver', 'tests', 'eslint']);
  for (const call of f.calls()) assert.equal(call.cwd, join(f.repo, 'calculator'));
  for (const [role, tools] of [['driver', 'read,edit,write,grep,find,ls'], ['navigator', 'read,grep,find,ls']]) {
    assert.deepEqual(f.calls(role)[0].args, ['--no-session', '--tools', tools, '-p']);
  }
  assert.match(f.calls('navigator')[0].input, /complexity exceeds 5/);
  assert.match(f.calls('navigator')[0].input, /Test diagnostic/);
  assert.match(f.calls('driver')[0].input, /Extract a named helper\. Plan 1/);
  assert.ok(!f.calls('driver')[0].input.includes('Navigator diagnostic'));
  assert.match(f.read('calculator/src/index.ts'), /edit 1/);
  assert.throws(() => f.read('factory/.tmp/evidence.txt'), { code: 'ENOENT' });
});

test('each failed check goes back to the navigator as plain feedback', t => {
  const f = fixture(t, { SCENARIO: 'fail-pass' });
  exits(f.run(['3']), 0);
  assert.equal(f.calls('navigator').length, 2);
  assert.equal(f.calls('driver').length, 2);
  assert.equal(f.calls('eslint').length, 3);
  assert.match(f.calls('navigator')[1].input, /ESLINT \(exit 1\)/);
  assert.match(f.calls('driver')[1].input, /Plan 2/);
});

test('a passing initial result makes no agent calls', t => {
  const f = fixture(t, { SCENARIO: 'clean' });
  exits(f.run(), 0);
  assert.deepEqual(f.calls().map(call => call.role), ['tests', 'eslint']);
});

for (const limit of [2, 5]) {
  test(`stops after ${limit} attempts and leaves edits for review`, t => {
    const f = fixture(t, { SCENARIO: 'fail' });
    const result = f.run(limit === 5 ? [] : [String(limit)]);
    exits(result, 1);
    assert.match(result.stdout, /Attempt limit reached/);
    assert.equal(f.calls('driver').length, limit);
    assert.equal(f.calls('navigator').length, limit);
    assert.equal(f.calls('tests').length, limit + 1);
    assert.equal(f.calls('eslint').length, limit + 1);
    assert.match(f.read('calculator/src/index.ts'), new RegExp(`edit ${limit}`));
  });
}

for (const status of ['1', '2']) {
  test(`tests exiting ${status} prevent acceptance despite an agent's success claim`, t => {
    const f = fixture(t, { TEST_EXIT: status });
    exits(f.run(['2']), 1);
    assert.equal(f.calls('driver').length, 2);
    assert.ok(f.calls('navigator')[1].input.includes(`TESTS (exit ${status})`));
  });
}

for (const [scenario, message, drivers] of [
  ['navigator-error', /navigator invocation failed/, 0],
  ['driver-error', /driver invocation failed/, 1],
  ['navigator-signal', /terminated by SIGTERM/, 0],
  ['driver-signal', /terminated by SIGTERM/, 1],
  ['eslint-error', /ESLint could not run/, 0],
  ['later-eslint-error', /ESLint could not run/, 1],
]) {
  test(`${scenario} stops rather than spending more attempts`, t => {
    const f = fixture(t, { SCENARIO: scenario });
    const result = f.run(['3']);
    exits(result, 2);
    assert.match(result.stderr, message);
    assert.equal(f.calls('driver').length, drivers);
  });
}

test('invalid limits fail before any commands run', t => {
  const f = fixture(t);
  for (const args of [['0'], ['-1'], ['1.5'], ['Infinity'], ['text'], ['--retry'], ['2', '3'], ['']]) {
    const result = f.run(args);
    exits(result, 2);
    assert.ok(!result.stdout.includes('$ '));
  }
});

test('old reports are neither read nor overwritten', t => {
  const f = fixture(t);
  f.put('factory/.tmp/evidence.txt', 'OLD REPORT');
  exits(f.run(), 0);
  assert.equal(f.read('factory/.tmp/evidence.txt'), 'OLD REPORT');
  assert.ok(!f.calls('navigator')[0].input.includes('OLD REPORT'));
});
