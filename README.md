# Ralph loop: refactoring

A small companion to [ralph-loop-demo](https://github.com/lean-software-production/ralph-loop-demo): one agent refactors a calculator, a separate agent checks the evidence, and a bounded loop feeds failures back. This is a standalone, script-reading tutorial—not the full software-factory course or a browser tutor.

## Setup

Use Node.js 24, npm 11, Git, and globally installed [Pi](https://github.com/earendil-works/pi). The Dev Container uses Node 24 and only the Pi feature; authenticate after opening it.

```sh
# Skip this if Pi is already installed.
npm install -g @earendil-works/pi-coding-agent
pi
```

Inside Pi, use `/login`, then `/model` to select a model. Exit Pi, then run these commands from the repository root:

```sh
npm install
npm test
npm run quality
npm run test:harness
```

The root package is a private npm workspace containing `calculator/`; install dependencies at the root. `npm test` runs the calculator tests. Quality findings are expected initially, so `npm run quality` should exit nonzero. Harness tests use deterministic mocked agents and make no paid calls. Actual Pi model calls cost tokens.

## The pieces

| File | Role |
| --- | --- |
| `calculator/` | Behaviour-tested, deliberately cramped refactoring exercise |
| `factory/refactor.md` | Doer instructions: one focused, behaviour-preserving refactor |
| `factory/refactor-do.sh` | Records the baseline, then invokes the doer; `--retry` adds findings |
| `factory/refactor-validate.md` | Validator instructions: judge the supplied evidence |
| `factory/refactor-validate.sh` | Collects evidence, invokes the validator, checks its verdict |
| `ralph.sh` | Repeats doer → validator up to a fixed attempt limit |

## Run it manually

Start with a clean calculator Git state, including no untracked calculator files.

```sh
./factory/refactor-do.sh
./factory/refactor-validate.sh
# Only after VERDICT: FAIL:
./factory/refactor-do.sh --retry
./factory/refactor-validate.sh
```

A fresh doer records `factory/.tmp/refactor-quality-before.txt`. A retry requires that baseline and previous findings; it appends the findings to the prompt without replacing the baseline. Each invocation starts a fresh Pi context with `--no-session`.

Validation gathers the calculator's `git diff HEAD`, untracked-file list, test output, and quality output under `factory/.tmp/`. Its answer is saved to `factory/.tmp/refactor-validate-findings.txt`; the first nonempty line must be exactly `VERDICT: PASS` or `VERDICT: FAIL`. Validator exit codes are **0** for PASS, **1** for FAIL, and **2** for tool errors, malformed output, or contradictions. A PASS with failing tests is rejected.

## Run the bounded loop

```sh
./ralph.sh       # at most 5 doer/validator attempts
./ralph.sh 3     # choose another positive limit
```

The loop starts fresh, retries only on FAIL while preserving the original baseline, and stops at the first PASS. It exits **0** on PASS, **1** on exhaustion, or **2** on error.

There are no automatic commits or rollbacks. Failed or exhausted changes remain for review. After success, inspect the diff and commit the accepted refactor manually before starting another fresh loop.

The doer gets `read,edit,write,grep,find,ls`; the validator gets only `read,grep,find,ls`. Neither gets `bash`. The harness—not the validator—runs tests and quality checks. These tool allowlists are not an OS/filesystem sandbox; review changes and use an isolated environment as appropriate.

Continue with the short [tutorial](docs/tutorial.md).

## Sources and attribution

Extracted from [software-factory-tutorial](https://github.com/lean-software-production/software-factory-tutorial), particularly lessons [002](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/002-build-a-doer.md), [003](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/003-build-a-validator.md), and [004](https://github.com/lean-software-production/software-factory-tutorial/blob/main/tutorial/docs/specs/004-feed-the-findings-back.md). This version moves evidence collection into the harness and makes retries preserve the baseline.

The calculator is copied byte-for-byte with its existing CC BY-SA notices. See its [README](calculator/README.md), [attribution](calculator/ATTRIBUTION.md), and [licence](calculator/LICENSE.md), including credit to [Chelsea Troy's original exercise](https://github.com/chelseatroy/python-exercises/tree/main/s9_code_quality_exercise). Those notices describe the calculator, not a blanket licence for this repository.
