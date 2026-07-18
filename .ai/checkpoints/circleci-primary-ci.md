# CircleCI Primary CI Migration

## Objective

Make CircleCI the primary project quality pipeline without duplicating Vitest, Studio build, or
Sonar coverage work. Preserve GitHub-native CodeQL, Dependabot, and release/tag automation. Keep
deployment markers disabled until a real preview deployment exists.

## Completion Criteria

- [x] PR #159 merged before the CI branches were rewritten.
- [x] PR #161 merged into #160 with conventional naming and a working Next build cache.
- [x] CircleCI runs `quality-core` and `studio-browser` in parallel, runs narrow `sonar-cloud` after
  core, then fans `sonar-cloud` and `studio-browser` into `quality-gate`.
- [x] SonarCloud uses the `SonarCloud` context and the existing redacted repository wrapper; the
  public orb remains disabled by organization policy without weakening the organization-wide
  setting.
- [x] GitHub Actions retains CodeQL, Dependabot, and release ownership without repeating project
  gates.
- [ ] PR #160 stays below 120 changed files and passes final local and hosted quality gates.
- [ ] One final cold-cache and one warm-cache run prove dependency, Next cache, Sonar, and fan-in
  behavior.

## Current State

- Branch/worktree: `circleci-project-setup` in the isolated `63dc` worktree.
- PR #159 merged to main at `a98af5f4`.
- PR #161 merged into #160 at `567d042a` after a green CircleCI run.
- The first live run exposed an empty 16-byte Next cache because only the core build ran. The fixed
  run `a27fa8f5-8948-4b90-ad3f-a58bb2f1b2d6` built Studio with webpack and stored a 29 MiB cache.
- The worktree now implements parallel `quality-core` and `studio-browser`, downstream
  `sonar-cloud`, and the final `quality-gate` fan-in. Core produces one Vitest LCOV/JUnit result;
  browser owns its production build/test and Next cache.
- Sonar uses `pnpm sonar:cloud`, the repository's redacted wrapper, because organization policy
  rejects the public orb. No organization-wide security setting was relaxed.
- GitHub's duplicate project CI and Sonar workflows are removed. CodeQL and Dependabot remain, and
  release waits for the exact triggering SHA's `ci/circleci: quality-gate` status before applying.
- CircleCI OAuth now has a read-only deploy checkout key, the project is followed, and GitHub has
  an active CircleCI push/pull-request webhook.
- Verified commands: `circleci auth me`, `circleci config validate --json`,
  `circleci config process .circleci/config.yml`, `circleci run get`, `circleci job get`,
  `circleci job output get`, `circleci context secret list SonarCloud`, and live GitHub PR/check
  inspection.
- The final pre-commit CircleCI config digest is
  `676b839ccb57b9ad2d4b61c04f4780dde8b197122522825af2f10e953731706e`; authenticated
  `circleci config validate --json` returned `valid: true`, and `circleci config process` expanded
  its cache, workspace, Node 22.23.0, Sonar, and fan-in steps successfully.
- External project settings are pinned to auto-cancel enabled, GitHub status enabled, fork builds
  and fork secrets disabled, and dynamic/unversioned config disabled.
- The CircleCI `SonarCloud` context contains `SONAR_TOKEN`; its value must never enter repository
  artifacts or logs.
- Final local evidence on Node 22.22.3: `pnpm check:static`, 261 Vitest files / 1168 tests with LCOV
  and JUnit, the webpack Studio build, 15 Playwright tests, usage smoke, product UAT, dependency
  audit, and version planning all passed. An earlier Node 26 run produced transient missing-module
  errors; both affected tests and the full suite passed after returning to the supported Node 22
  runtime. A redundant final `pnpm check` rerun was intentionally stopped after these component
  gates were already green.

## Decisions

- TDD Route: `Mode: off / Decision: skipped`; use proportional config, script, and hosted CI
  verification rather than a forced strict TDD loop.
- CircleCI owns project checks, browser QA, coverage, the repository-wrapped SonarCloud scan, and
  the final status fan-in.
- GitHub Actions owns CodeQL, Dependabot, and release/tag automation.
- Cache only the pnpm store and `apps/studio/.next/cache`; never cache `node_modules` or build output.
- `build-prs-only` remains disabled; the OAuth project override now identifies `main`.
- No new CI provider, runtime provider, deployment adapter, or public publishing path is in scope.

## Remaining Work

1. Prove one final cold-cache and one warm-cache hosted run, including `sonar-cloud`, browser
   artifacts, cache evidence, and the `ci/circleci: quality-gate` commit status.
2. Close the final spec/code-quality review and keep PR #160 within the 120-file delivery cap.
3. Merge #160 only after successful hosted CI, then verify the `main` pipeline and release gate.

## Blockers And Risks

- The initial OAuth project existed without a follower, checkout key, or webhook. That external
  setup is repaired; future push-trigger verification is still required on the final #160 commit.
- The organization blocks the public Sonar orb. The repository wrapper is the approved narrow
  alternative; it must keep token and endpoint details redacted in artifacts and logs.
- Required GitHub status rules are not changed in this slice because the existing release bot
  performs a direct main push and has no narrowly scoped bypass.
