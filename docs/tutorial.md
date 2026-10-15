# From description to a bounded refactoring loop

Follow the [setup](../README.md#setup) first. Work from the repository root unless a command says otherwise. Read the supplied scripts as you go; you do not need to rebuild them or run a browser tutor. Pi model calls cost tokens.

## 1. Describe before changing

Start with a read-only Pi invocation:

```sh
(cd calculator && pi --no-session --tools read,grep,find,ls -p \
  'Read the calculator source and tests. Describe one small refactoring opportunity. Do not change files or run commands.')
```

Compare the description with the source. Does it identify a concrete problem and explain how behaviour would stay unchanged? A plausible description is not evidence that a change works.

The tool list omits shell and editing tools. It limits the tools offered to this invocation; it does not confine filesystem access at the OS level.

## 2. Let the doer make one change

Read [`factory/refactor.md`](../factory/refactor.md) and [`factory/refactor-do.sh`](../factory/refactor-do.sh). Find where the script checks for a clean calculator, records quality output, and invokes Pi.

```sh
./factory/refactor-do.sh
```

The fresh run requires a clean calculator Git state. It records `factory/.tmp/refactor-quality-before.txt` before the doer edits anything. The doer gets `read,edit,write,grep,find,ls`, but no `bash`; it cannot run the test or quality commands through a shell tool.

Read the diff yourself. Did the doer make one focused, behaviour-preserving change? Its closing explanation is a claim, not a test result.

## 3. Give a separate validator the evidence

Read [`factory/refactor-validate.md`](../factory/refactor-validate.md) and [`factory/refactor-validate.sh`](../factory/refactor-validate.sh). Identify the boundary between deterministic evidence gathering and model judgment.

```sh
./factory/refactor-validate.sh
```

The harness gathers `git diff HEAD` for the calculator, a separate untracked-file list, `npm test`, and `node scripts/quality.mjs` output into `factory/.tmp/` files. Untracked files are not part of the Git diff. The harness supplies this evidence and the original quality baseline to the validator.

The validator gets only `read,grep,find,ls`: no shell and no editing tools. It judges whether the refactor preserves behaviour and improves the reported quality findings against the baseline. Fewer complaints are useful evidence, not a complete definition of good design.

Read `factory/.tmp/refactor-validate-findings.txt`. Its first nonempty line must be exactly `VERDICT: PASS` or `VERDICT: FAIL`, followed by evidence. Exit **0** means PASS; **1** means FAIL; **2** means a tool error, malformed response, or contradiction. The harness rejects PASS when tests failed.

## 4. Feed a failure back without moving the baseline

If validation reports FAIL, read the findings before retrying:

```sh
./factory/refactor-do.sh --retry
./factory/refactor-validate.sh
```

`--retry` requires both the existing baseline and previous findings. It appends those findings to the doer prompt and leaves the baseline untouched. Replacing the baseline now would change the comparison halfway through the attempt sequence.

Every doer and validator call uses `--no-session`: a fresh Pi context, not a remembered conversation. The prompts, calculator files, baseline, and findings carry the state. The second doer behaves differently because its input changed, not because it learned between calls.

If the first change passes, skip the retry rather than manufacturing a failure. Inspect and commit an accepted change before beginning another fresh run.

## 5. Put the repetition in a bounded loop

Read [`ralph.sh`](../ralph.sh). Locate the fresh doer call, validation, retry branch, and stopping conditions.

```sh
./ralph.sh       # default: at most 5 attempts
# Or, from a clean calculator state:
./ralph.sh 3
```

One attempt is a doer turn followed by validation. The loop starts fresh, retries on FAIL against the same baseline, and stops immediately on PASS. It exits **0** on success, **1** when attempts run out, and **2** on error. Do not start it over uncommitted calculator changes from a manual run.

Run `npm run test:harness` to exercise the orchestration with deterministic mocked agents and no paid calls. These tests check harness behaviour, not whether a real model will produce a good refactor.

The loop never commits or rolls back. Inspect the final diff; failed and exhausted changes remain too. Commit accepted work manually before the next fresh loop. A verdict ends the automation—not your responsibility for the change.
