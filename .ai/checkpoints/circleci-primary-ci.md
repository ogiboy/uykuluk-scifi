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
- [ ] Refresh the optional remote parity snapshot to Node 22.23/pnpm 11.9 after explicit approval
      for the tracked encrypted vault ciphertext transfer.

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
- Successful full workflows measured 7m02s, 8m37s, and 7m27s. The former medians were about 13m08s
  on GitHub Actions and 17m56s on the original serial CircleCI graph.
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

1. Complete and merge the capability-routing documentation slice so all agents use the actual lane
   and Chunk profile names.
2. Refresh and verify the optional sidecar image only after the operator explicitly accepts transfer
   of tracked encrypted vault ciphertext to the private snapshot. Do not sync plaintext `.env`.
3. Continue measuring warm PR latency; investigate if the median exceeds 10 minutes again.

## Blocker

The existing sidecar snapshot predates the Node 22.23/pnpm 11.9 target. Creating its replacement
would copy tracked encrypted `.env.vault` ciphertext to a private third-party snapshot. The transfer
remains paused until the operator gives explicit risk-aware approval; no workaround or hidden sync
is permitted.
