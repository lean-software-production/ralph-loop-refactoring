# Ralph loop: refactoring

A small companion to [ralph-loop-demo](https://github.com/lean-software-production/ralph-loop-demo): a navigator plans a calculator refactoring, a driver makes the change, and tests and ESLint provide feedback. A short JavaScript loop repeats until the result is good enough or the attempt limit is reached.

## Setup

Use Node.js 24, npm 11, Git, and globally installed [Pi](https://github.com/earendil-works/pi). The Dev Container includes Node 24 and the Pi feature.

```sh
# Skip this if Pi is already installed.
npm install -g @earendil-works/pi-coding-agent
pi
```

Inside Pi, use `/login`, then `/model` to select a model. Exit Pi, then run these commands from the repository root:

```sh
npm install
npm test
```

The private root package contains two npm workspaces: `calculator/` and `factory/`. The calculator is deliberately cramped but has passing tests. The factory keeps its loop and prompts in `src/` and its harness tests in `test/`. `npm test` runs both packages' tests; `npm run test:harness` runs only the factory tests. Harness tests mock the agents and checks; they make no paid calls. Actual model calls cost tokens.

## The workflow

Read [`factory/src/run.mjs`](factory/src/run.mjs). Its main loop is:

```js
while (true) {
  const result = check();

  if (goodEnough(result)) break;
  if (attempts >= maxAttempts) break;

  const instructions = planNextMove(result);
  implement(instructions);
  attempts++;
}
```

- `check()` runs the calculator tests and ESLint.
- `goodEnough(result)` requires both commands to exit successfully.
- `planNextMove(result)` asks the read-only navigator for instructions in plain English.
- `implement(instructions)` asks the driver to make the change.

The navigator and driver prompts are [`factory/src/navigator.md`](factory/src/navigator.md) and [`factory/src/driver.md`](factory/src/driver.md). Each turn starts a fresh Pi context with `--no-session`. The navigator sees the latest check output and can read the current source. There is no validator agent, fixed target, baseline comparison, structured response protocol, or resume state.

ESLint checks complexity, function size, duplication, and other configured rules. All findings must be cleared for this exercise to finish successfully, so several small refactorings may be needed. The broader `npm run quality` command also runs Knip; Knip is not part of this loop.

## Run it

Use an isolated checkout or worktree and review any existing edits first:

```sh
npm start          # at most 5 navigator/driver attempts
npm start -- 10    # choose another positive limit
```

The program checks before the first edit and after every edit, including the last allowed attempt. It exits **0** when tests and ESLint pass, **1** when attempts run out, or **2** on an invocation error. Output goes to the terminal; results stay in memory and no report files are written.

The navigator gets read-only tools. The driver can edit files. Neither gets a shell tool. Source-only editing and preserving tests, configuration, and behaviour are prompt instructions, not protections enforced by JavaScript or an OS sandbox.

Nothing is committed or rolled back. Inspect the diff yourself, including tests and configuration, before accepting a result. Passing checks are evidence, not proof of unchanged behaviour or good design.

Continue with the short [tutorial](docs/tutorial.md).

## Sources and attribution

Extracted from [software-factory-tutorial](https://github.com/lean-software-production/software-factory-tutorial), particularly lessons [002](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/002-build-a-doer.md), [003](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/003-build-a-validator.md), and [004](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/004-feed-the-findings-back.md). This version uses navigator/driver agents and deterministic checks in a small JavaScript loop.

The calculator is copied byte-for-byte with its existing CC BY-SA notices. See its [README](calculator/README.md), [attribution](calculator/ATTRIBUTION.md), and [licence](calculator/LICENSE.md), including credit to [Chelsea Troy's original exercise](https://github.com/chelseatroy/python-exercises/tree/main/s9_code_quality_exercise). Those notices describe the calculator, not a blanket licence for this repository.
