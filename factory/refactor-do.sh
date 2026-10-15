#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

retry=false
case "${1:-}" in
  '') [ "$#" -eq 0 ] || { echo 'Usage: refactor-do.sh [--retry]' >&2; exit 2; } ;;
  --retry) [ "$#" -eq 1 ] || { echo 'Usage: refactor-do.sh [--retry]' >&2; exit 2; }; retry=true ;;
  *) echo 'Usage: refactor-do.sh [--retry]' >&2; exit 2 ;;
esac
command -v pi >/dev/null || { echo 'Install and authenticate Pi first.' >&2; exit 2; }
mkdir -p .tmp

if "$retry"; then
  if [ ! -s .tmp/refactor-quality-before.txt ] || [ ! -s .tmp/refactor-validate-findings.txt ]; then
    echo 'A retry needs the original baseline and validation findings. Run the doer and validator first.' >&2
    exit 2
  fi
else
  if [ -n "$(git -C .. status --porcelain --untracked-files=all -- calculator)" ]; then
    echo 'Start with a clean calculator. Review and commit or set aside existing changes first.' >&2
    exit 2
  fi
  echo 'Recording quality baseline...'
  rm -f .tmp/refactor-quality-before.txt .tmp/refactor-validate-findings.txt
  if (cd ../calculator && node scripts/quality.mjs) > .tmp/baseline-output.txt 2>&1; then
    quality_status=0
  else
    quality_status=$?
  fi
  if [ "$quality_status" -gt 1 ]; then
    echo 'Could not record quality baseline. See factory/.tmp/baseline-output.txt.' >&2
    exit 2
  fi
  {
    printf 'BASELINE QUALITY (exit %s):\n' "$quality_status"
    cat .tmp/baseline-output.txt
  } > .tmp/refactor-quality-before.txt
fi

echo 'Starting doer...'
{
  cat refactor.md
  if "$retry"; then
    printf '\nPREVIOUS VALIDATION FINDINGS:\n'
    cat .tmp/refactor-validate-findings.txt
  fi
} | (cd ../calculator && pi --no-session --tools read,edit,write,grep,find,ls -p)
