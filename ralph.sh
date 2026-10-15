#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
attempts=${1:-5}
if [ "$#" -gt 1 ] || ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]] || [ "${#attempts}" -gt 6 ]; then
  echo 'Usage: ./ralph.sh [max_attempts: 1..999999]' >&2
  exit 2
fi

for ((attempt=1; attempt<=attempts; attempt++)); do
  printf '\nAttempt %s/%s\n' "$attempt" "$attempts"
  if [ "$attempt" -eq 1 ]; then
    ./factory/refactor-do.sh || exit 2
  else
    ./factory/refactor-do.sh --retry || exit 2
  fi
  if ./factory/refactor-validate.sh; then
    echo 'PASS. Review the diff and commit the refactoring if you accept it.'
    exit 0
  else
    status=$?
    [ "$status" -eq 1 ] || exit 2
  fi
done

echo 'Attempt limit reached. Changes and evidence are left for review; nothing was committed.' >&2
exit 1
