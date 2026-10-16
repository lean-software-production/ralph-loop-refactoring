import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const factory = new URL('../', import.meta.url);

function main() {
  const maxAttempts = Number(process.argv[2] ?? 5);
  if (process.argv.length > 3 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Usage: npm start -- [positive attempt limit]');
  }
  process.chdir(fileURLToPath(new URL('../calculator/', factory)));
  let attempts = 0;

  while (true) {
    const result = check();

    if (goodEnough(result)) break;
    if (attempts >= maxAttempts) {
      console.log('Attempt limit reached.');
      process.exitCode = 1;
      break;
    }

    const instructions = planNextMove(result);
    implement(instructions);
    attempts++;
  }

  console.log('Review the diff. Nothing was committed or rolled back.');
}

function check() {
  const tests = run('npm', ['test']);
  const eslint = run('npm', ['exec', '--no', '--', 'eslint', 'src', '--no-inline-config']);
  if (eslint.status > 1) throw new Error('ESLint could not run.');
  return { tests, eslint };
}

function goodEnough(result) {
  return result.tests.status === 0 && result.eslint.status === 0;
}

function planNextMove(result) {
  return agent('navigator', `TESTS (exit ${result.tests.status}):\n${result.tests.output}
ESLINT (exit ${result.eslint.status}):\n${result.eslint.output}`, 'read,grep,find,ls');
}

function implement(instructions) {
  agent('driver', instructions, 'read,edit,write,grep,find,ls');
}

function agent(role, instructions, tools) {
  const prompt = readFileSync(new URL(`./${role}.md`, import.meta.url), 'utf8');
  const result = run('pi', ['--no-session', '--tools', tools, '-p'], `${prompt}\n${instructions}`);
  if (result.status !== 0) throw new Error(`${role} invocation failed.`);
  return result.stdout;
}

function run(command, args, input) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { input, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} was terminated by ${result.signal}.`);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr };
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
