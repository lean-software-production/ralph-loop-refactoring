#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ "$#" -eq 0 ] || { echo 'Usage: refactor-validate.sh' >&2; exit 2; }
if [ ! -s .tmp/refactor-quality-before.txt ]; then
  echo 'No quality baseline. Run ./factory/refactor-do.sh first.' >&2
  exit 2
fi
command -v pi >/dev/null || { echo 'Install and authenticate Pi first.' >&2; exit 2; }

echo 'Gathering diff, tests, and quality evidence...'
(cd ../calculator && git diff --no-ext-diff --no-textconv HEAD -- .) > .tmp/refactor-diff.txt
(cd ../calculator && git ls-files --others --exclude-standard -- .) > .tmp/refactor-untracked.txt
if (cd ../calculator && npm test) > .tmp/refactor-tests.txt 2>&1; then
  test_status=0
else
  test_status=$?
fi
if (cd ../calculator && node scripts/quality.mjs) > .tmp/refactor-quality-after.txt 2>&1; then
  quality_status=0
else
  quality_status=$?
fi
if [ "$quality_status" -gt 1 ]; then
  echo 'Quality command could not run. See factory/.tmp/refactor-quality-after.txt.' >&2
  exit 2
fi

echo 'Starting independent validator...'
if ! {
  cat refactor-validate.md
  printf '\n--- BASELINE ---\n'
  cat .tmp/refactor-quality-before.txt
  printf '\n--- git diff HEAD (calculator only) ---\n'
  cat .tmp/refactor-diff.txt
  printf '\n--- Untracked calculator files (read these too) ---\n'
  cat .tmp/refactor-untracked.txt
  printf '\n--- npm test (exit %s) ---\n' "$test_status"
  cat .tmp/refactor-tests.txt
  printf '\n--- node scripts/quality.mjs (exit %s) ---\n' "$quality_status"
  cat .tmp/refactor-quality-after.txt
} | (cd ../calculator && pi --no-session --tools read,grep,find,ls -p) \
  | tee .tmp/refactor-validate-findings.txt; then
  echo 'Validator invocation failed; this is not a refactoring verdict.' >&2
  exit 2
fi

verdict=$(awk 'NF { print; exit }' .tmp/refactor-validate-findings.txt)
case "$verdict" in
  'VERDICT: PASS')
    if [ "$test_status" -ne 0 ]; then
      echo 'Refusing PASS: the test command failed. Inspect the evidence before continuing.' >&2
      exit 2
    fi
    exit 0 ;;
  'VERDICT: FAIL') exit 1 ;;
  *) echo 'Malformed verdict; expected VERDICT: PASS or VERDICT: FAIL on the first non-empty line.' >&2; exit 2 ;;
esac
