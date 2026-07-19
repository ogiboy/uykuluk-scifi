# Primary CI And Fast-Parity Checkpoint

## Objective

Keep one fast, evidence-rich primary quality pipeline without duplicating Vitest, Studio build, or
Sonar work. Preserve GitHub-native CodeQL, Dependabot, and release/tag automation. Use Chunk only as
a bounded local or remote parity companion.

## Completion Criteria

- [x] The primary pipeline classifies delivery scope before opening expensive lanes.
- [x] Static, two-shard unit, usage, product, and browser work starts in parallel.
- [x] Unit artifacts merge into verified JUnit and LCOV; CircleCI stores JUnit and Sonar consumes
      the persisted LCOV without rerunning Vitest.
- [x] Studio builds once per workflow and Playwright uses the prebuilt output.
- [x] The final gate waits for every required lane and reports one exact-SHA status.
- [x] pnpm, Next, and Sonar caches show warm hits without caching `node_modules` or build output.
- [x] Release planning skips the Circle gate when no release is needed and otherwise waits at most
      30 minutes for the exact main SHA.
- [x] PR #164 merged after final CircleCI, Sonar, and CodeQL success.
- [ ] Verify the configured remote parity snapshot boots with Node 22.23/pnpm 11.9 and passes the
      named `parity-remote` profile.

## Current State

- PR #164 merged to main as `434b0e772c3947056e8e6a7047b1cef93ef45170` on 2026-07-18.
- `delivery-policy` writes `.ci/delivery-scope.json`. Product and CI changes run `static-quality`,
  two-executor `unit-tests`, `usage-smoke`, `product-uat`, and `studio-browser` in parallel.
  `unit-results` merges and verifies JUnit/LCOV, publishes JUnit, and persists LCOV. `sonar-cloud`
  receives that LCOV through the shared workspace without rerunning tests. `quality-gate` explicitly
  waits for both `unit-results` and Sonar alongside the other required work.
- Policy-only changes prove their scope and halt the unneeded heavy lanes. Unknown paths default to
  reviewable product scope. The limit is 100 reviewable files; exact generated-tooling prefixes can
  exceed 100 raw files only while both counts remain visible.
- Successful full workflows measured 7m02s, 8m37s, 7m27s, and 8m45s. The former medians were about
  13m08s on GitHub Actions and 17m56s on the original serial CircleCI graph.
- Warm runs restored a roughly 224 MiB pnpm cache, a roughly 31 MiB Next compiler cache, and the
  Sonar runtime cache. Only the designated lanes write each immutable cache.
- A repeated warm run exposed one real WebKit timing flake. Its trace showed `/ideas/new` returned
  HTTP 200 with no failed assets, but the streamed UI appeared about 0.6 seconds after the former
  five-second assertion expired. The fix pins Turkish locale and widens only that route assertion;
  the final browser lane passed.
- GitHub Actions owns CodeQL, Dependabot, and release automation. Release runs `version:plan` before
  polling `ci/circleci: quality-gate`, exits immediately when no release is planned, and bounds a
  releaseable SHA wait to 30 minutes.
- External project settings retain auto-cancel and GitHub statuses, disable fork-secret transfer,
  dynamic config, and unversioned config, and leave the deployment marker detached.
- The `SonarCloud` context contains `SONAR_TOKEN`; its value never enters repository artifacts or
  logs. The repository's redacted wrapper and full checkout remain the scanner boundary.
- `quick-local` is the automatic changed-file hook, `static-local` is the intentional local static
  profile, and `parity-remote` is the authenticated sidecar `pnpm check:static` profile. None is a
  substitute for the hosted quality gate.
- `.nvmrc` selects the same Node 22.23.0 line used by every CircleCI job. `pnpm ci:config:verify`
  enables an explicit local-only pipeline parameter so `circleci config process` expands the real
  quality DAG and proves its restore/save cache steps instead of pruning the event-gated workflow.

## Decisions

- Heavy suites run once in CircleCI. Local iteration uses focused tests, direct lint/typecheck, or a
  bounded Chunk profile.
- CircleCI owns project integration, browser QA, coverage, Sonar, and final fan-in. GitHub owns
  CodeQL, dependency updates, and release/tag mutation.
- Cache only the pnpm store, `apps/studio/.next/cache`, and Sonar runtime downloads.
- Keep the deployment marker disabled until a real preview deployment exists.
- CodeRabbit review quota failures are not product-quality evidence and should not be retriggered
  repeatedly; actual comments are resolved, while CircleCI and CodeQL remain the completion proof.

## Remaining Work

1. Boot the configured sidecar snapshot and prove Node 22.23/pnpm 11.9 plus `parity-remote` once.
2. Continue measuring warm PR latency; investigate if the median exceeds 10 minutes again.
3. Keep exact-SHA GitHub statuses plus the linked Circle workflow as the operational source of truth
   when the preview Circle CLI omits a GitHub-App-triggered run from `run list`.

## Blocker

The configured snapshot exists but has not yet been boot-verified against the current repository and
toolchain. Plaintext `.env` files remain excluded from every sidecar sync.
