# Studio Frontend Product Workstream

## Objective

Move Studio from a read-only shell toward the v1 operator production desk while keeping CLI/core as
the source of truth for state, approvals, costs, evidence, readiness, artifacts, and disabled
upload/publish boundaries.

## Completion Criteria

- Studio lets an operator inspect the local production queue, run detail, media evidence, artifacts,
  readiness, guarded local approvals, render decisions, and manual handoff state without duplicating
  workflow logic.
- Mutating Studio actions remain limited to guarded local service contracts and must not upload,
  schedule, publish, call paid providers, or infer approval from files.
- Frontend changes are validated with targeted Studio lint/typecheck/build and browser smoke;
  broader `pnpm check` / UAT gates run at PR-ready or merge-adjacent points.
- Related frontend slices are grouped into fewer broad PRs with Conventional Commit history and
  changelog coverage.

## Current State

- Branch/worktree: `feat/local-production-proof` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`.
- Active PR: #120, `feat(studio): expand local production operator surface`, open against `main`.
- Last completed slice/commit: `113336eb feat(studio): add tabbed run review cockpit`.
- Completed current-branch frontend slices include:
  - shadcn route/action primitives for guarded local actions;
  - Studio home control desk, queue filters, command palette, copyable safe commands;
  - shadcn dropdown/popover/card/badge/dialog overlays;
  - run-detail tabbed review cockpit for progress, media, artifacts, handoff, readiness, and guarded
    decisions.
- Verified commands for the latest slice:
  - `pnpm --filter @uykulukscifi/studio lint`
  - `pnpm --filter @uykulukscifi/studio typecheck`
  - `pnpm --filter @uykulukscifi/studio build`
  - `node scripts/qa/modularity-gate.mjs --fail-on-findings`
  - `pnpm changelog:check`
  - `pnpm release:check`
  - `pnpm format:check`
  - browser smoke on `/runs/run_20260702013835_ada7ab` across Media, Artifacts, Readiness, and
    Decisions tabs.
- Dirty or external changes to preserve: none at the checkpoint update point.

## Decisions

- Continue using shadcn primitives for buttons, tabs, dialogs, dropdowns, popovers, badges, cards,
  inputs, and related operator controls.
- Keep Studio workflow-first and dense-product oriented; do not apply public landing-page taste
  patterns to the production desk.
- Prefer browser smoke evidence over broad Playwright/UAT runs for small frontend slices; run
  heavier gates before merge-readiness.

## Remaining Work

1. Inspect PR #120 hosted checks and CodeRabbit comments when they finish; fix only valid findings.
2. Continue the next frontend slice inside the same broad PR if it is still coherent: likely run
   artifact preview ergonomics, media playback/download handoff, or route-security/session UX.
3. After the PR is stable, merge or hand off according to current branch rules, then start the next
   broader product slice.

## Blockers And Risks

- Hosted CI/Sonar/CodeRabbit are asynchronous and may surface findings after local validation.
- Studio mutations are intentionally narrow; expanding web control beyond guarded local approvals
  requires route-security, CSRF/session, negative tests, and explicit product approval.
