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
- Use `codex/` branches for Codex-created work unless the task specifies another convention.
- Use Conventional Commits.
- Preserve unrelated user changes in dirty worktrees.
- Keep coherent vertical slices and small green commits.
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
