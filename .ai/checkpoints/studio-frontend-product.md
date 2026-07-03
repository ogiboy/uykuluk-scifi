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
- Active local slice: shared Studio shell, brand, appearance controls, semantic navigation, loading,
  and route-boundary recovery across operator pages.
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
  - route-level loading skeletons and shimmer placeholders for Studio home, run index, and run
    detail so local run/artifact waits keep the operator layout visible.
  - Next Image-backed Studio brand lockup, shared home navigation rail, and local operator
    appearance controls for theme, palette, language, and density preferences.
  - shared Studio shell and loading skeletons across home, run queue, run detail, analytics, assets,
    doctor, model-eval, and prompt inventory pages.
  - Studio `not-found`, `error`, `/unauthorized`, and `/forbidden` route boundaries that show safe
    recovery guidance without mutating producer state or exposing local filesystem details.
  - semantic component pass for Studio route links, run-index table markup, default button types,
    skeleton accessibility, workflow lists, and review rail landmarks.
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
  - `pnpm changelog:check`
  - `pnpm format:check`
  - semantic source audit for route anchors, fake table roles, button type defaults, and labelled
    grouping landmarks under `apps/studio/src/components`.
  - browser smoke on Studio home with system Chrome: logo rendered, appearance controls persisted
    light/violet/compact preferences, and desktop/mobile body overflow stayed `0px`.
  - browser smoke on `/runs`: native `table.run-table` exposed 8 column headers and row headers,
    mobile card mode preserved `Run` labels, and no 4xx responses were observed.
- Earlier branch checks also included modularity, release, targeted Vitest, and browser smoke across
  run detail Media, Artifacts, Readiness, Decisions, and mobile overflow surfaces.
- Dirty or external changes to preserve: current local branch contains the uncommitted Studio
  appearance/shell slice pending commit.

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
- Studio should become the primary human control surface for v1 operator work. CLI/core remains the
  workflow source of truth and a power-user/AI automation surface; the TUI should stay usable but
  should not block the web desk from becoming the main review and approval UI.
- Prefer built-in Next.js and React primitives before adding infrastructure: `next/link`,
  `next/image`, route metadata, server components, route loading boundaries, caching primitives, and
  current form state APIs.
- Use Next.js caching deliberately: stable shell/navigation/config projections may be cached when
  safe, but local run status, evidence, approval, readiness, cost, upload, and publish-risk surfaces
  must remain fresh enough to preserve fail-closed operator decisions.
- Client components should stay as leaf-level as practical; server components should keep owning
  local artifact reads and typed projections.
- Loading states should keep the surrounding Studio surface usable and use skeleton/shimmer states
  for delayed local data instead of blank panels.
- Forms should be semantic, responsive, and stateful: local validation should show invalid input
  near the field, pending states should not blank the page, and modal/backdrop blocking should be
  reserved for guarded actions that must prevent competing interactions.
- Theme work should cover dark/light, language, palette presets, and density/layout presets such as
  compact, standard, and wide without changing CLI/core workflow semantics.
- GSAP or richer motion should be used only where it improves operator orientation or status change
  comprehension, with reduced-motion behavior preserved.
- HTTP cookies alone are not enough authority for risky Studio mutations. Any broader web control
  surface needs explicit session and CSRF design, origin checks, unauthorized/forbidden route
  surfaces, short-lived operator proofs, negative tests, and preservation of the CLI/core approval
  ledger as the source of truth.
- Next.js `unauthorized()` and `forbidden()` auth interrupts remain experimental in current docs, so
  Studio should keep stable normal trust-boundary routes until adopting that API is an explicit
  product decision.
- The run queue still needs a real data-grid pass. Native table markup is semantically safer than
  fake grids, but the current operator UX is not enough for dense filtering/sorting. Evaluate
  TanStack Table plus shadcn Table and `@tanstack/react-virtual` before heavier grids such as AG
  Grid.

## Remaining Work

1. Commit the shared Studio shell and route-boundary slice after focused validation.
2. Continue the next frontend slice on the same broad branch if coherent: run-queue data grid,
   route-security session UX, artifact preview ergonomics, theme/density controls, richer form
   states, or media playback/download handoff.
3. Open a PR only after related frontend/operator-action work is grouped and locally validated.

## Blockers And Risks

- Hosted CI/Sonar/CodeRabbit are asynchronous and may surface findings after local validation.
- Studio mutations are intentionally narrow; expanding web control beyond guarded local approvals
  requires route-security, CSRF/session, negative tests, and explicit product approval.
