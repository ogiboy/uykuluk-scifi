#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT_DIR/tools/mflux"
VENV_DIR="$PROJECT_DIR/.venv"
COMMAND="${1:-status}"
CONFIRMATION="${2:-}"

# require_uv verifies that the uv command is available and exits with an error if it is missing.
require_uv() {
  if ! command -v uv >/dev/null 2>&1; then
    printf 'uv is required for the managed MFLUX Python environment. Install uv, then retry.\n' >&2
    exit 1
  fi
}

# sync_environment verifies the dependency lockfile and synchronizes the MFLUX environment with Python 3.12.
sync_environment() {
  require_uv
  uv lock --check --project "$PROJECT_DIR"
  uv sync --locked --project "$PROJECT_DIR" --python 3.12
}

# remove_environment removes the MFLUX virtual environment after `--yes` confirmation and path verification.
remove_environment() {
  if [[ "$CONFIRMATION" != "--yes" ]]; then
    printf 'Refusing to remove %s without --yes.\n' "$VENV_DIR" >&2
    exit 1
  fi
  case "$VENV_DIR" in
    "$ROOT_DIR"/tools/mflux/.venv) rm -rf "$VENV_DIR" ;;
    *) printf 'Refusing to remove an unexpected environment path.\n' >&2; exit 1 ;;
  esac
}

case "$COMMAND" in
  sync)
    sync_environment
    ;;
  check)
    require_uv
    uv lock --check --project "$PROJECT_DIR"
    uv run --locked --no-sync --offline --project "$PROJECT_DIR" python -c \
      'import huggingface_hub, mflux; print("MFLUX environment is ready")'
    ;;
  activate)
    if [[ ! -x "$VENV_DIR/bin/python" ]]; then
      printf 'The MFLUX environment is missing. Run pnpm mflux:env:sync first.\n' >&2
      exit 1
    fi
    printf 'source %q\n' "$VENV_DIR/bin/activate"
    ;;
  remove)
    remove_environment
    ;;
  recreate)
    remove_environment
    sync_environment
    ;;
  status)
    if ! command -v uv >/dev/null 2>&1; then
      printf 'MFLUX Python tooling: uv missing; Studio manual/mock paths remain available.\n'
    elif [[ -x "$VENV_DIR/bin/python" ]]; then
      printf 'MFLUX Python tooling: environment present at %s.\n' "$VENV_DIR"
    else
      printf 'MFLUX Python tooling: uv ready; environment will be created only after approved setup.\n'
    fi
    ;;
  *)
    printf 'Usage: %s {status|sync|check|activate|remove --yes|recreate --yes}\n' "$0" >&2
    exit 2
    ;;
esac
