# Quality Gates and Release Policy

Use focused checks while developing a slice. Run the broad gates when the branch is PR-ready or
merge-adjacent.

## Focused Development

```bash
pnpm exec vitest run <focused-test-files>
pnpm typecheck
pnpm typecheck:compat
pnpm studio:typecheck
pnpm studio:typecheck:compat
```

Exercise the real Studio/browser journey when UI or route behavior changes. Passing unit tests alone
does not prove the operator workflow.

### Chunk inner loop

Chunk is intentionally narrower than the PR gate. The commit and session-stop hooks run the
changed-file profile through installed binaries, so they cannot turn an ordinary edit into an
implicit dependency reinstall:

```bash
chunk validate quick-local # changed JS/TS lint plus Prettier checks
```

Use the broader profiles deliberately rather than after every edit:

```bash
chunk validate static-local  # root/Studio lint and primary typechecks
chunk validate parity-remote # authenticated sidecar run of pnpm check:static
```

`parity-remote` is an intentional Linux/toolchain parity check, not the normal edit loop. A Chunk
result never substitutes for the hosted CircleCI quality gate. Dependency installation is not a
commit hook; the normal bootstrap and CircleCI jobs own frozen installs. Full Vitest, browser UAT,
dependency analysis, and Sonar should not be repeated locally after every small change.

This setup follows the official
[Chunk v0.7 hook contract](https://github.com/CircleCI-Public/chunk-cli/blob/v0.7.119/docs/HOOKS.md).

## PR-Ready Gates

```bash
pnpm check
pnpm qa:usage
pnpm qa:product
pnpm qa:browser
pnpm security:dependencies
pnpm version:plan
pnpm test:coverage
pnpm sonar:cloud
```

`pnpm check` includes lint, both TypeScript lanes, builds, smoke tests, Vitest, Studio checks,
modularity, secret scanning, changelog validation, release validation, and formatting.

These commands remain the complete local contract for exceptional offline or merge-adjacent
verification. Normal pull requests run the heavy integration work once in CircleCI; during edits,
use focused tests, direct lint/typecheck, or the bounded Chunk profiles above.

## CI Ownership

CircleCI is the primary integration pipeline. `delivery-policy` classifies the diff and writes
`.ci/delivery-scope.json`. Product or CI changes start these independent lanes in parallel:

1. `static-quality`: lint, both TypeScript toolchains, core build, dependency audit, and static QA.
2. `unit-tests`: two Vitest shard executors, each producing blob and coverage artifacts.
3. `usage-smoke`: only `pnpm qa:usage`.
4. `product-uat`: only `pnpm qa:product`.
5. `studio-browser`: one webpack production build followed by prebuilt Playwright tests.

`unit-results` merges the two shard reports into one verified JUnit and LCOV result. It publishes
JUnit to CircleCI test results and persists LCOV to the shared workspace. `sonar-cloud` attaches
that workspace through the common lane guard, skips a duplicate coverage run, and passes the
persisted LCOV to the repository's redacted scanner wrapper with full Git history. `quality-gate`
waits for both `unit-results` and Sonar explicitly, in addition to static quality, usage, product
UAT, and Studio browser. Policy-only documentation changes halt unneeded lanes after the scope
artifact proves the skip.

Three disjoint GitHub App triggers own integration events: PR opened, pushes to open non-draft PRs,
and pushes to the default branch. The legacy GitHub OAuth project is disabled. The workflow also
accepts explicit API triggers. This keeps opening or updating a PR to one integration run per
revision instead of parallel OAuth push and GitHub App pull-request duplicates.

Only one lane writes the immutable pnpm-store cache. The browser lane restores and saves
`apps/studio/.next/cache`; Sonar restores its scanner/JRE cache. `node_modules`, complete `.next`
output, and browser binaries are not cached. GitHub Actions retains CodeQL, Dependabot, and the
main-branch release gate only. Release runs `version:plan` first: a no-release SHA exits without
waiting, while a releaseable SHA waits up to 30 minutes for its exact `ci/circleci: quality-gate`
status and never reruns project tests or builds.

Measured PR evidence on 2026-07-18 was 7m02s, 8m37s, and 7m27s for successful full workflows. The
former medians were approximately 13m08s on GitHub Actions and 17m56s on the original serial
CircleCI graph. Warm runs confirmed pnpm, Next, and Sonar cache hits.

## Failure Routing

1. Inspect the hosted failing SHA and job before reproducing anything locally.
2. Read `.ci/delivery-scope.json` to distinguish an expected halted lane from a failure.
3. Reproduce the exact job command or smallest failing test, not the full repository gate.
4. Use `quick-local` for changed-file feedback, `static-local` for a broader local static boundary,
   and authenticated `parity-remote` only for deliberate remote parity.
5. Inspect stored JUnit, LCOV, Playwright trace/screenshot/video, and Sonar evidence before changing
   timeouts or retrying a flaky check.

Chunk green means the selected local/sidecar profile passed. It is not CircleCI quality-gate proof.

For an operator investigation, reproduce the relevant local command, then use
`pnpm producer readiness --run <run_id>`, `pnpm producer evidence --run <run_id>`, or
`pnpm producer doctor` to capture actionable state and recovery guidance. These are local evidence
commands, not live paid CI.

Docker/local Sonar is optional local tooling and is not required when Docker is unavailable. Live
paid provider calls do not run in CI.

## TypeScript Compatibility

The main compiler uses the repository's current TypeScript lane. The `tsc6` alias and
`*:typecheck:compat` scripts verify the supported next-compiler lane without forcing ESLint/parser
dependencies onto an unsupported compiler.

## Test Stability

Local Vitest uses bounded workers and the fail-fast timeout. CI uses its explicit worker and timeout
profile. Do not hide flaky timeouts by increasing limits without a root-cause check. For browser
timing failures, inspect the Playwright trace and keep any widened timeout route- and
browser-scoped.

## Branch and Commits

- Base new work on current `origin/main`.
- Use conventional, descriptive product-intent branch names (for example `feat/`, `fix/`, `docs/`,
  or `chore/`); do not use an AI-agent or vendor prefix.
- Use Conventional Commits.
- Preserve unrelated user changes in dirty worktrees.
- Keep coherent vertical slices and small green commits.
- Keep each PR at or below 100 reviewable changed files. A dedicated generated-tooling catalog may
  exceed 100 raw files only through the exact central allowlist; raw and reviewable counts must both
  remain visible.
- Do not bump package versions manually on feature branches.

## Version Planning

`pnpm version:plan` derives the next release from the latest stable tag and pending conventional
commits. It reports the pending tag and changelog source without modifying files.

## Main Release

Pushes to protected `main` run the release workflow. When releaseable commits exist, automation
updates `package.json`, moves Unreleased changelog entries into a versioned section, creates the
release commit, and pushes the tag atomically. The workflow refreshes `origin/main` and retries when
main advances during earlier jobs.

Keep `CHANGELOG.md` and its `<!-- version list -->` marker intact. Validate release-range commit
subjects with `pnpm release:check` before handoff.

## Evidence to Report

PR handoff should name the tests and gates actually run, distinguish skipped/live-only checks, and
call out any unrelated existing failure. Do not claim production validation from mocks or a green
typecheck.
