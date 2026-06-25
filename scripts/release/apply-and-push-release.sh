#!/usr/bin/env bash
set -euo pipefail

branch="${GITHUB_REF_NAME:-main}"
max_attempts="${RELEASE_PUSH_MAX_ATTEMPTS:-3}"

if [[ ! "${max_attempts}" =~ ^[1-9][0-9]*$ ]]; then
  echo "RELEASE_PUSH_MAX_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

parse_plan_field() {
  local field="$1"
  node -e "const fs = require('node:fs'); const p = JSON.parse(fs.readFileSync(0, 'utf8')); const value = p['${field}']; console.log(value === undefined || value === null ? '' : String(value));"
}

for attempt in $(seq 1 "${max_attempts}"); do
  echo "Preparing release attempt ${attempt}/${max_attempts} from origin/${branch}."
  git fetch origin "${branch}" --tags
  git reset --hard "origin/${branch}"

  plan="$(pnpm --silent version:plan)"
  echo "${plan}"

  release_needed="$(parse_plan_field releaseNeeded <<<"${plan}")"
  next_version="$(parse_plan_field nextVersion <<<"${plan}")"

  if [[ "${release_needed}" != "true" ]]; then
    echo "No releaseable commits found on origin/${branch}."
    exit 0
  fi

  if [[ -z "${next_version}" ]]; then
    echo "Release plan requested a release without nextVersion." >&2
    exit 1
  fi

  pnpm release:apply

  tag="v${next_version}"
  git add CHANGELOG.md package.json
  if git diff --cached --quiet; then
    echo "No release file changes to commit."
    exit 0
  fi

  git commit -m "chore(release): ${tag}"
  git tag -a "${tag}" -m "chore(release): ${tag}"

  if git push --atomic origin "HEAD:${branch}" "refs/tags/${tag}"; then
    echo "Published ${tag}."
    exit 0
  fi

  echo "Atomic release push failed; refreshing latest ${branch} and retrying." >&2
  git tag -d "${tag}" >/dev/null 2>&1 || true
done

echo "Release push failed after ${max_attempts} attempts." >&2
exit 1
