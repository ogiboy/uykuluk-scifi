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

- Branch/worktree: `feat/studio-operator-actions` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`.
- Merged PR: #121, `feat(studio): expand operator workbench controls`, merged into `main` as
  `97a6ebb6` on 2026-07-02.
- Active local slice: Studio visual QA and responsive layout polish for the home, run index, and run
  detail operator surfaces.
- Last completed slice/commit before this checkpoint:
  `fix(studio): stabilize operator ui primitives`.
- Completed current-branch frontend slices include:
  - shadcn route/action primitives for guarded local actions;
  - Studio home control desk, queue filters, command palette, copyable safe commands;
  - shadcn dropdown/popover/card/badge/dialog overlays;
  - run-detail tabbed review cockpit for progress, media, artifacts, handoff, readiness, and guarded
    decisions.
  - production-media review cards with copyable review, local playback, and render-approval handoff
    commands.
  - guarded-action preflight summaries for approval and render-decision panels, showing payload,
    evidence, readiness, blocked-action, and upload/publish boundaries before submission.
  - artifact review handoff path in the Artifacts tab, showing the review documents available for
    script, render-plan contact sheet, voiceover, draft render, final review bundle, and manual
    channel handoff.
  - visual overflow fixes for Studio shell/main containment, run table scrolling, mobile navigation,
    long run ids, detail rail metadata, and narrow-screen metric grids.
  - run index table sizing that fits common desktop widths plus labeled mobile run cards for narrow
    screens.
  - PR review fixes for approval confirmation payload visibility, ready-queue blocked-run exclusion,
    workflow overflow indicators, tooltip delay, full command-palette search, client-side palette
    navigation, fail-closed short-lived Studio sessions, and shared Studio next-command fallbacks.
  - dependency-free production-package path contract sharing for render-plan schemas and Studio
    builds, plus the missing Skeleton React type import.
  - hosted browser-smoke fallout fix for the Studio home heading assertion after the operator
    control desk redesign.
- Verified commands for the latest slice:
  - `pnpm --filter @uykulukscifi/studio lint`
  - `pnpm --filter @uykulukscifi/studio typecheck`
  - `pnpm --filter @uykulukscifi/studio build`
  - `node scripts/qa/modularity-gate.mjs --fail-on-findings`
  - `pnpm changelog:check`
  - `pnpm release:check`
  - `pnpm format:check`
  - `pnpm vitest run tests/studioRunQueueFilters.test.ts`
  - `pnpm vitest run tests/studioMutationClient.test.ts`
  - `pnpm typecheck`
  - `pnpm vitest run tests/renderPlan.test.ts tests/renderPlanCli.test.ts tests/productionPackageIntegrity.test.ts`
  - `pnpm qa:browser`
  - browser smoke on `/runs/run_20260702013835_ada7ab` across Media, Artifacts, Readiness, and
    Decisions tabs.
  - browser smoke on `/runs/run_20260702013835_ada7ab` Media tab for rendered media cards and
    copyable review/playback controls.
  - browser overflow audit on Studio home, `/runs`, and `/runs/run_20260702013835_ada7ab` at desktop
    and mobile widths; final mobile home/detail/runs body overflow was `0px` at 390px viewport.
- Dirty or external changes to preserve: current local branch contains the uncommitted responsive UI
  polish slice pending commit.

## Decisions

- Continue using shadcn primitives for buttons, tabs, dialogs, dropdowns, popovers, badges, cards,
  inputs, and related operator controls.
- Keep Studio workflow-first and dense-product oriented; do not apply public landing-page taste
  patterns to the production desk.
- Prefer browser smoke evidence over broad Playwright/UAT runs for small frontend slices; run
  heavier gates before merge-readiness.
- Future guarded forms should prefer React/Next server-action patterns such as `useActionState` or
  equivalent form-state handling where they simplify validation, pending state, and fail-closed
  operator feedback.
- Prefer built-in Next.js and React primitives before adding infrastructure: `next/link`,
  `next/image`, server components, route loading boundaries, caching primitives, and current form
  state APIs.
- Client components should stay as leaf-level as practical; server components should keep owning
  local artifact reads and typed projections.
- Loading states should keep the surrounding Studio surface usable and use skeleton/shimmer states
  for delayed local data instead of blank panels.
- Theme work should cover dark/light, language, palette presets, and density/layout presets such as
  compact, standard, and wide without changing CLI/core workflow semantics.
- GSAP or richer motion should be used only where it improves operator orientation or status change
  comprehension, with reduced-motion behavior preserved.

## Remaining Work

1. Commit the responsive UI polish slice after focused validation.
2. Continue the next frontend slice on the same broad branch if coherent: route-security session UX,
   artifact preview ergonomics, skeleton/loading states, theme/density controls, or media
   playback/download handoff.
3. Open a PR only after related frontend/operator-action work is grouped and locally validated.

## Blockers And Risks

- Hosted CI/Sonar/CodeRabbit are asynchronous and may surface findings after local validation.
- Studio mutations are intentionally narrow; expanding web control beyond guarded local approvals
  requires route-security, CSRF/session, negative tests, and explicit product approval.
