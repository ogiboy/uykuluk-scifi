#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${SONAR_ARTIFACT_DIR:-${REPO_ROOT}/.ai/qa/artifacts/sonar}"
LCOV_PATH="${SONAR_JAVASCRIPT_LCOV:-${ARTIFACT_DIR}/coverage/lcov.info}"
SCAN_LOG="${ARTIFACT_DIR}/sonar-npm.log"
PNPM_EXECUTABLE="${PNPM_EXECUTABLE:-pnpm}"

SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-uykuluk-scifi}"
SONAR_PROJECT_NAME="${SONAR_PROJECT_NAME:-UykulukSciFi Producer}"
SONAR_ORGANIZATION="${SONAR_ORGANIZATION:-}"
SONAR_TOKEN_KEYCHAIN_SERVICE="${SONAR_TOKEN_KEYCHAIN_SERVICE:-codex-sonarqube-token}"
SONAR_TOKEN_KEYCHAIN_ACCOUNT="${SONAR_TOKEN_KEYCHAIN_ACCOUNT:-${USER:-}}"

cd "${REPO_ROOT}"
mkdir -p "${ARTIFACT_DIR}"

resolve_token() {
  if [[ -z "${SONAR_TOKEN:-}" ]] && command -v security >/dev/null 2>&1 && [[ -n "${SONAR_TOKEN_KEYCHAIN_ACCOUNT}" ]]; then
    SONAR_TOKEN="$(
      security find-generic-password \
        -a "${SONAR_TOKEN_KEYCHAIN_ACCOUNT}" \
        -s "${SONAR_TOKEN_KEYCHAIN_SERVICE}" \
        -w 2>/dev/null || true
    )"
  fi

  if [[ -z "${SONAR_TOKEN:-}" ]]; then
    echo "SONAR_TOKEN is required. Set it in the environment or store it in macOS Keychain service '${SONAR_TOKEN_KEYCHAIN_SERVICE}'." >&2
    exit 1
  fi

  export SONAR_TOKEN
}

redacted_runner() {
  local -a command=("$@")
  "${command[@]}" 2>&1 \
    | SONAR_TOKEN_REDACT="${SONAR_TOKEN}" perl -pe 'BEGIN { $t = $ENV{SONAR_TOKEN_REDACT} // ""; } if (length $t) { s/\Q$t\E/<redacted>/go }' \
    | tee "${SCAN_LOG}"
}

if [[ "${SONAR_SKIP_COVERAGE:-0}" != "1" ]]; then
  echo "Writing JavaScript/TypeScript coverage to ${LCOV_PATH}"
  "${PNPM_EXECUTABLE}" run --silent test:coverage
fi

resolve_token

command=(
  "${PNPM_EXECUTABLE}" exec sonar
  "-Dsonar.host.url=${SONAR_HOST_URL}"
  "-Dsonar.projectKey=${SONAR_PROJECT_KEY}"
  "-Dsonar.projectName=${SONAR_PROJECT_NAME}"
)

if [[ -f "${LCOV_PATH}" ]]; then
  command+=("-Dsonar.javascript.lcov.reportPaths=${LCOV_PATH}")
fi
if [[ -n "${SONAR_ORGANIZATION}" ]]; then
  command+=("-Dsonar.organization=${SONAR_ORGANIZATION}")
fi
if [[ -n "${SONAR_BRANCH_NAME:-}" ]]; then
  command+=("-Dsonar.branch.name=${SONAR_BRANCH_NAME}")
fi

echo "Running @sonar/scan for project '${SONAR_PROJECT_KEY}' at ${SONAR_HOST_URL}"
redacted_runner "${command[@]}"
echo "Sonar scanner log: ${SCAN_LOG}"
