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

## CI Ownership

CircleCI is the primary quality pipeline. `quality-core` and `studio-browser` run in parallel: the
core job owns `pnpm check:static`, one Vitest run with LCOV and JUnit, usage/product checks,
dependency audit, and version planning; the browser job owns the production Studio build and test.
After core succeeds, the narrow `sonar-cloud` job restores its coverage artifact and invokes the
repository's existing redacted Sonar wrapper. The public Sonar orb is not used because organization
policy disallows it; the migration does not weaken that organization-wide setting. `quality-gate`
fans in `sonar-cloud` and `studio-browser`.

Cold and warm pnpm plus Next.js caches keep the pipeline bounded. GitHub Actions retains CodeQL,
Dependabot, and the main-branch release gate only; release polls the `ci/circleci: quality-gate`
status for the triggering `main` SHA, installs only the dependencies required by the release script,
and never reruns checks, builds, browser tests, or paid provider calls.

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
profile. Do not hide flaky timeouts by increasing limits without a root-cause check.

## Branch and Commits

- Base new work on current `origin/main`.
- Use conventional, descriptive product-intent branch names (for example `feat/`, `fix/`, `docs/`,
  or `chore/`); do not use an AI-agent or vendor prefix.
- Use Conventional Commits.
- Preserve unrelated user changes in dirty worktrees.
- Keep coherent vertical slices and small green commits.
- Keep each PR at or below 120 changed files.
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
