import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, chmodSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = fileURLToPath(new URL('../', import.meta.url));
const fakeCommand = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.env.RECORD_DIR, 'calls.jsonl');
const calls = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse) : [];
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const role = tool === 'pi' ? (args.includes('read,edit,write,grep,find,ls') ? 'doer' : 'validator') : tool;
const count = calls.filter(c => c.role === role).length + 1;
const input = tool === 'pi' ? fs.readFileSync(0, 'utf8') : '';
fs.appendFileSync(file, JSON.stringify({ tool, role, args, cwd: process.cwd(), input }) + '\\n');
if (tool === 'node') {
  if (args.join(' ') !== 'scripts/quality.mjs') process.exit(99);
  console.log(count === 1 ? 'QUALITY BASELINE: 3 findings' : 'QUALITY CURRENT: 2 findings');
  process.exit(count === 1 ? 1 : 0);
}
if (tool === 'npm') {
  if (args.join(' ') !== 'test') process.exit(99);
  console.log(process.env.TEST_EXIT === '1' ? 'tests failed' : 'all tests passed');
  process.exit(Number(process.env.TEST_EXIT || 0));
}
if (role === 'doer') {
  if (process.env.EDIT_SOURCE !== '0') fs.appendFileSync('src/index.ts', '\\n// refactoring attempt ' + count + '\\n');
  console.log('Refactored calculator source.');
  process.exit(process.env.SCENARIO === 'doer-error' ? 7 : 0);
}
const scenario = process.env.SCENARIO;
if (scenario === 'malformed') console.log('I think this passes.');
else {
  const fail = scenario === 'fail' || (scenario === 'fail-pass' && count === 1);
  console.log('\\nVERDICT: ' + (fail ? 'FAIL' : 'PASS') + '\\nEVIDENCE:\\n' + (fail ? 'Repair duplicated branch before retrying.' : 'Quality improved and tests passed.'));
}
process.exit(scenario === 'validator-error' ? 7 : 0);
`;

function fixture(t, env = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ralph-harness-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const records = join(root, 'records');
  for (const dir of [repo, bin, records]) mkdirSync(dir);
  const put = (file, text) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), text);
  };
  for (const file of ['ralph.sh', 'factory/refactor-do.sh', 'factory/refactor-validate.sh', 'factory/refactor.md', 'factory/refactor-validate.md', '.gitignore']) {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    copyFileSync(join(project, file), join(repo, file));
    if (file.endsWith('.sh')) chmodSync(join(repo, file), 0o755);
  }
  put('calculator/src/index.ts', 'export const calculate = () => 42;\n');
  put('calculator/scripts/quality.mjs', '// Quality execution is replaced by the fixture node.\n');
  put('calculator/package.json', '{"private":true,"scripts":{"test":"exit 0"}}\n');
  for (const name of ['pi', 'npm', 'node']) {
    writeFileSync(join(bin, name), fakeCommand);
    chmodSync(join(bin, name), 0o755);
  }
  const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RECORD_DIR: records, SCENARIO: 'pass', TEST_EXIT: '0', EDIT_SOURCE: '1', ...env };
  const git = (...args) => {
    const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    return result.stdout;
  };
  git('init', '-q');
  git('config', 'user.name', 'Harness');
  git('config', 'user.email', 'harness@example.invalid');
  git('add', '.');
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Fixture');
  return {
    repo, put, git,
    run(script = 'ralph.sh', args = []) {
      return spawnSync('bash', [join(repo, script), ...args], { cwd: root, env: environment, encoding: 'utf8', timeout: 10000 });
    },
    read(file) { return readFileSync(join(repo, file), 'utf8'); },
    calls(role) {
      let calls;
      try { calls = readFileSync(join(records, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
      catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      return role ? calls.filter(call => call.role === role) : calls;
    },
  };
}

function exits(result, status, message) {
  assert.equal(result.status, status, `${message || ''}\n${result.stdout}\n${result.stderr}\n${result.error || ''}`);
}

test('PASS stops after one attempt; agents use calculator cwd and restricted tools', t => {
  const f = fixture(t);
  const initialCommit = f.git('rev-parse', 'HEAD');
  exits(f.run('ralph.sh', ['4']), 0);
  assert.equal(f.calls('doer').length, 1);
  assert.equal(f.calls('validator').length, 1);
  for (const call of f.calls()) assert.equal(call.cwd, join(f.repo, 'calculator'));
  for (const [role, tools] of [['doer', 'read,edit,write,grep,find,ls'], ['validator', 'read,grep,find,ls']]) {
    assert.deepEqual(f.calls(role)[0].args, ['--no-session', '--tools', tools, '-p']);
    assert.ok(!tools.split(',').includes('bash'));
  }
  const evidence = f.calls('validator')[0].input;
  for (const text of ['QUALITY BASELINE: 3 findings', 'QUALITY CURRENT: 2 findings', 'npm test (exit 0)', 'quality.mjs (exit 0)', 'refactoring attempt 1']) assert.ok(evidence.includes(text), text);
  assert.match(f.read('calculator/src/index.ts'), /refactoring attempt 1/);
  assert.equal(f.git('rev-parse', 'HEAD'), initialCommit, 'harness must not commit');
});

test('FAIL then PASS retains the original baseline and sends findings to the retry', t => {
  const f = fixture(t, { SCENARIO: 'fail-pass' });
  exits(f.run('ralph.sh', ['3']), 0);
  assert.equal(f.calls('doer').length, 2);
  assert.equal(f.calls('validator').length, 2);
  assert.equal(f.calls('node').length, 3, 'baseline should run only once');
  assert.equal(f.read('factory/.tmp/refactor-quality-before.txt'), 'BASELINE QUALITY (exit 1):\nQUALITY BASELINE: 3 findings\n');
  const [first, retry] = f.calls('doer');
  assert.ok(!first.input.includes('PREVIOUS VALIDATION FINDINGS:'));
  assert.match(retry.input, /PREVIOUS VALIDATION FINDINGS:\n\nVERDICT: FAIL/);
  assert.match(retry.input, /Repair duplicated branch before retrying/);
  for (const call of f.calls('validator')) assert.match(call.input, /BASELINE QUALITY \(exit 1\):\nQUALITY BASELINE/);
});

test('repeated FAIL exhausts the bound with exit 1 and retains findings', t => {
  const f = fixture(t, { SCENARIO: 'fail' });
  exits(f.run('ralph.sh', ['2']), 1);
  assert.equal(f.calls('doer').length, 2);
  assert.equal(f.calls('validator').length, 2);
  assert.match(f.read('factory/.tmp/refactor-validate-findings.txt'), /VERDICT: FAIL/);
});

for (const [scenario, message, validators] of [
  ['malformed', /Malformed verdict/, 1],
  ['validator-error', /Validator invocation failed/, 1],
  ['doer-error', /Refactored calculator source/, 0],
]) {
  test(`${scenario} stops with exit 2 rather than retrying`, t => {
    const f = fixture(t, { SCENARIO: scenario });
    const result = f.run('ralph.sh', ['3']);
    exits(result, 2);
    assert.match(result.stdout + result.stderr, message);
    assert.equal(f.calls('doer').length, 1);
    assert.equal(f.calls('validator').length, validators);
  });
}

test('PASS cannot override failing tests', t => {
  const f = fixture(t, { TEST_EXIT: '1' });
  const result = f.run('ralph.sh', ['3']);
  exits(result, 2);
  assert.match(result.stderr, /Refusing PASS/);
  assert.equal(f.calls('doer').length, 1);
  assert.equal(f.calls('validator').length, 1);
  assert.match(f.calls('validator')[0].input, /npm test \(exit 1\)/);
});

test('validator refuses a missing baseline before invoking any checks or agents', t => {
  const f = fixture(t);
  exits(f.run('factory/refactor-validate.sh'), 2);
  assert.deepEqual(f.calls(), []);
});

test('retry refuses missing findings even with an existing baseline', t => {
  const f = fixture(t);
  exits(f.run('factory/refactor-do.sh'), 0);
  const before = f.calls();
  const baseline = f.read('factory/.tmp/refactor-quality-before.txt');
  const result = f.run('factory/refactor-do.sh', ['--retry']);
  exits(result, 2);
  assert.match(result.stderr, /retry needs/);
  assert.deepEqual(f.calls(), before);
  assert.equal(f.read('factory/.tmp/refactor-quality-before.txt'), baseline);
});

for (const file of ['calculator/src/index.ts', 'calculator/src/untracked.ts']) {
  test(`fresh doer refuses pre-existing changes in ${basename(file)}`, t => {
    const f = fixture(t);
    f.put(file, '// pre-existing work\n');
    exits(f.run('factory/refactor-do.sh'), 2);
    assert.deepEqual(f.calls(), []);
    assert.equal(f.read(file), '// pre-existing work\n');
  });
}

test('invalid attempt limits return 2 without invoking agents or checks', t => {
  const f = fixture(t);
  for (const limit of ['0', '-1', 'text', '1000000', '999999999999999999999999']) exits(f.run('ralph.sh', [limit]), 2, limit);
  assert.deepEqual(f.calls(), []);
});

test('standalone scripts work from another cwd and generated evidence stays ignored', t => {
  const f = fixture(t, { EDIT_SOURCE: '0' });
  exits(f.run('factory/refactor-do.sh'), 0);
  exits(f.run('factory/refactor-validate.sh'), 0);
  assert.match(f.read('factory/.tmp/refactor-validate-findings.txt'), /VERDICT: PASS/);
  assert.equal(f.git('status', '--porcelain', '--untracked-files=all'), '');
  assert.equal(f.git('check-ignore', 'factory/.tmp/refactor-quality-before.txt').trim(), 'factory/.tmp/refactor-quality-before.txt');
});
