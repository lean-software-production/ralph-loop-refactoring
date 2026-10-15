# A small refactoring loop

Follow the [setup](../README.md#setup), then read [`factory/run.mjs`](../factory/run.mjs). The calculator starts with passing tests and deliberately awkward code. The aim is to refactor it until tests and ESLint both pass.

## 1. Check the current result

At the top of the loop, `check()` runs tests and ESLint. It returns their exit statuses and output in memory. There are no baseline or report files.

`goodEnough(result)` is the stopping rule: both commands must exit 0. ESLint reports complexity, size, duplication, and other configured problems. An improved complexity score is useful progress, but the loop continues while findings remain.

The separate `npm run quality` command also runs Knip for unused-code findings. This tutorial's loop uses only tests and ESLint.

## 2. Decide the next move

Read [`factory/navigator.md`](../factory/navigator.md). `planNextMove(result)` gives that prompt and the latest check output to a fresh, read-only Pi invocation.

The navigator reads the source and tests, then gives concrete instructions in plain English. It may choose a new small refactoring or repair a problem from the previous edit. It does not edit files, run commands, or decide when the loop stops.

There is no plan schema or target-selection protocol to learn: its response becomes the driver's instructions.

## 3. Implement the instructions

Read [`factory/driver.md`](../factory/driver.md). `implement(instructions)` asks a fresh Pi invocation to make the change.

The driver can read and edit files but has no shell tool. Its prompt says to change only calculator source while preserving behaviour, tests, dependencies, and configuration. Those are instructions, not restrictions enforced by the program.

The driver's explanation is not evidence that the result works. The next loop iteration runs the checks again.

## 4. Repeat or stop

The loop checks two stopping conditions:

```js
if (goodEnough(result)) break;
if (attempts >= maxAttempts) break;
```

The successful-result check comes first, so a successful final attempt still counts as success. A run may need several refactorings; it is not limited to accepting one improvement against a baseline.

Each agent turn has a fresh context. The source files carry the edits, and the latest check output tells the navigator what remains to fix. Nothing is resumed from old reports or a remembered conversation.

## 5. Run and review

Use an isolated checkout or worktree. Work from the repository root and choose one command:

```sh
node factory/run.mjs       # up to 5 edits
node factory/run.mjs 10    # up to 10 edits
```

Each edit has one navigator turn and one driver turn. There is a check before the first edit and after every edit. Model calls cost tokens. The program exits **0** when checks pass, **1** when attempts run out, or **2** on an invocation error.

Read the terminal output and inspect the diff. The program does not protect existing edits, enforce the source-file boundary, commit, or roll back. Check that tests and rules were not weakened. Passing tests and ESLint do not prove unchanged behaviour or good design.

Run `npm run test:harness` to exercise the loop with mocked agents and checks, without paid calls.

The whole idea is: **check, plan the next move, implement, repeat until good enough or out of attempts.**
