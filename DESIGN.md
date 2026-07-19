# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-07-19
- Primary product surfaces: Studio dashboard, episode workspace, editorial review, voice audition,
  visual review, render review, settings and onboarding, private distribution review, and Advanced
  diagnostics.
- Evidence reviewed:
  - `CONTEXT.md`
  - `.ai/design-system.instructions.md`
  - `.ai/workflows/frontend-dashboard-workflow.instructions.md`
  - `.ai/agents/operator-ux.agent.md`
  - `.ai/checkpoints/studio-frontend-product.md`
  - `README.md`
  - `ROADMAP.md`
  - `apps/studio/src/app/globals.css`
  - `apps/studio/src/app/layout.tsx`
  - `apps/studio/src/components/studio/StudioShell.tsx`
  - `apps/studio/src/components/studio/StudioNavigationRail.tsx`
  - `apps/studio/src/components/settings/SettingsWorkspace.tsx`
  - `apps/studio/src/components/eval/ModelEvalOverviewView.tsx`
  - `apps/studio/src/components/doctor/DoctorOverviewView.tsx`
  - `docs/images/studio-dashboard.png`
  - `docs/images/studio-run-detail.png`
  - `docs/images/studio-voice-audition.png`
  - committed production assets under `assets/`
- Observed strengths: a stable operator shell, restrained graphite palette, visible next action,
  durable status language, theme and density controls, and established review surfaces.
- Observed weaknesses: repeated generic card treatment, small secondary text, dense horizontal
  compositions that strain narrow screens, technical evidence competing with the primary decision,
  and uneven visual hierarchy between workflow state and supporting detail.

## Brand

- Personality: cinematic, nocturnal, precise, scientifically curious, calm under operational
  pressure, and handcrafted rather than generic AI-themed.
- Trust signals: explicit current state, source and rights provenance, visible cost, human review
  identity, clear blockers, immutable evidence, and honest provider readiness.
- Avoid: purple AI glow, decorative orbital noise without meaning, marketing heroes inside the
  operator product, fake telemetry, excessive glass blur, card grids without hierarchy, hidden
  failure states, and playful copy during blocked or paid operations.

## Product goals

- Goals:
  - Make Studio the complete normal operator journey for two publishable V1 episodes.
  - Keep the current decision, blocker, cost, and next action understandable at a glance.
  - Support script comparison, voice audition, visual candidate selection, exact render review, and
    private distribution without normal CLI use.
  - Make local-model installation and readiness understandable without exposing runtime plumbing.
  - Preserve deep evidence for expert inspection without forcing it into every decision surface.
- Non-goals:
  - A generic AI video platform or autonomous content factory.
  - Public or scheduled publishing.
  - A marketing-site visual language inside production workspaces.
  - A generic cloud-provider console, team-management suite, or infrastructure dashboard.
- Success signals:
  - One primary safe action is obvious on every production screen.
  - An operator can explain why an action is blocked without opening raw artifacts.
  - The two V1 acceptance episodes require no source-code change, hidden repair, manual assembly, or
    normal CLI use.
  - Visual and functional browser acceptance passes in Turkish and English across supported sizes
    and themes.

## Personas and jobs

- Primary persona: the single channel producer and operator responsible for editorial judgment,
  provider choices, spending decisions, media quality, and private distribution.
- Supporting persona: the same operator in an Advanced troubleshooting context; this is not a
  separate administrator role.
- User jobs:
  - Understand the current episode stage and the next safe action.
  - Compare content and media alternatives before making one canonical choice.
  - Install and verify local models without terminal knowledge.
  - Approve exact paid operations with visible cost and consequences.
  - Recover failed or uncertain operations without duplicate spending.
  - Review publishability and private processing evidence.
- Key contexts of use: focused desktop production, occasional tablet review, narrow mobile status
  inspection, slow local model download, provider outage, and long-running render or upload
  operations.

## Information architecture

- Primary navigation:
  - Dashboard
  - Episodes
  - Library
  - Analytics
  - Settings
- Advanced navigation:
  - Doctor
  - Model Lab
  - Actions
  - Prompt Inventory
- Core routes and screens:
  - Dashboard: active work, blockers, and the next episode action.
  - Episodes: brief creation, episode queue, stage workspace, and final review.
  - Library: generated and imported media, provenance, and reusable production assets.
  - Settings: provider defaults, budgets, prompt profiles, appearance, and local-model setup.
  - Model setup: required capability readiness, package installation, progress, verification, and
    recovery.
  - Advanced: evidence, diagnostics, ledgers, raw paths, and typed recovery actions.
- Content hierarchy:
  1. Current stage and primary decision.
  2. Content or media being reviewed.
  3. Cost, blockers, rights, and readiness.
  4. Alternatives, revision history, and supporting context.
  5. Raw evidence and diagnostics in Advanced.

## Design principles

- Decision before evidence: show what must be decided and why before showing implementation detail.
- Honest readiness: absent, installing, ready, blocked, experimental, and unavailable are distinct
  states with no optimistic inference.
- One canonical choice: comparisons may be rich, but each script, voice, scene, render, and upload
  revision resolves to one explicit canonical selection.
- Progressive disclosure: normal operation stays concise; Advanced preserves technical depth.
- Quiet premium utility: achieve quality through proportion, typography, surface layering, and
  precise motion rather than decorative excess.
- Local-first clarity: local, hosted, manual, mock, and diagnostic paths are visibly different.
- Recovery is product work: interruption, retry, resume, and uncertain outcome states receive
  first-class layouts and copy.
- Tradeoffs:
  - Density is valuable for expert work, but primary decisions receive more space than diagnostics.
  - Premium surface depth is welcome, but nested decoration must not create cards inside cards or
    weaken scan speed.
  - Motion aids orientation, but reduced motion and long-running operation clarity take priority.

## Visual language

- Color:
  - Preserve the graphite base, cyan primary action, amber review attention, red blocker, and muted
    steel text family.
  - Light mode uses neutral mineral surfaces rather than pure-white marketing layouts.
  - Violet remains an optional palette, not the default AI-brand signal.
- Typography:
  - Preserve the current Turkish `latin-ext` capable Inter and JetBrains Mono stack until a
    dedicated typography comparison proves a replacement improves readability and bundle behavior.
  - Use display scale sparingly for route identity; operational content remains compact but never
    below comfortable reading size.
  - Monospace is reserved for identifiers, digests, timestamps, and machine evidence.
- Spacing and layout rhythm:
  - Use a consistent 4/8-based rhythm with 16–24 pixel control spacing and 24–32 pixel major section
    spacing.
  - Give primary review media and decisions asymmetric visual priority over status summaries.
  - Avoid uniform equal-size card grids when one item is clearly more important.
- Shape, radius, and elevation:
  - Use restrained concentric surface layering for primary workspaces and media viewers.
  - Keep ordinary controls and secondary panels simpler; do not wrap every component in a decorative
    shell.
  - Prefer hairline tonal separation and subtle inner highlights over generic grey borders or dark
    drop shadows.
- Motion:
  - Use transform and opacity with custom physical easing for panel changes, progress transitions,
    and canonical-selection feedback.
  - Avoid continuous ambient motion in production workspaces.
  - Do not animate layout dimensions for decoration.
  - Respect reduced motion and retain immediate state clarity without animation.
- Imagery and iconography:
  - Use committed channel and production assets where they help media review or brand orientation.
  - Icons are thin, precise, consistently sized, and always paired with accessible names when
    meaning is not obvious.
  - Scientific and cinematic imagery supports episode work; it does not become dashboard wallpaper
    that harms contrast.

## Components

- Existing components to reuse:
  - Studio shell and navigation rail.
  - Standard route header and eyebrow hierarchy.
  - shadcn and Radix buttons, dialogs, selects, tabs, badges, tooltips, forms, and accessible
    overlays.
  - Existing appearance, guarded-action, media playback, artifact preview, table, and review
    components.
- New or changed components:
  - Local capability readiness summary.
  - Model package installation and progress surface.
  - Disk-space preflight and package detail disclosure.
  - Resume, retry, verify, and remove-or-repair actions with explicit consequences.
  - Clearly labeled mock-diagnostic and operator-input alternatives.
  - Publishability scorecard and source-to-claim workspace.
  - Private upload and processing review surface.
- Variants and states:
  - Absent, checking, downloading, paused, verifying, ready, update available, failed, unavailable,
    and incompatible.
  - Required, recommended, optional, experimental, and diagnostic-only.
  - Normal, warning, blocked, destructive, and recovery actions.
- Token and component ownership:
  - Global theme and density tokens remain in Studio's existing CSS token layer.
  - Shared primitives remain under the existing UI component ownership.
  - Feature components own composition, not new global token systems.

### Local model setup interface decision

- Service shape: a capability-oriented core service with two public operations:
  - `readOverview()` returns the canonical readiness projection.
  - `submitIntent(intent)` accepts a closed set of typed install, resume, verify, activate, and
    recovery intents.
- Initial capabilities: real local visual generation through MFLUX and local language generation
  through supported local LLM packages.
- Information architecture: **Settings → Local Models**, with contextual links from Doctor, Model
  Lab, and blocked episode actions. It does not add another primary-navigation destination.
- Screen composition:
  - A readiness spine distinguishes capability readiness from episode evidence.
  - The active installation or recovery task receives the dominant workspace.
  - Disk, runtime ownership, and evidence freshness remain visible as supporting truth.
  - Raw manifests, paths, digests, and diagnostics stay in Advanced disclosure.
- Interaction rules:
  - One heavyweight download or managed-runtime operation runs at a time.
  - Studio submits package and action identities from a curated catalog; it never submits arbitrary
    download URLs, shell commands, runtime flags, or destination paths.
  - MFLUX remains a hard gate for real local visual generation.
  - Mock diagnostics and operator input remain visibly non-equivalent alternatives and cannot
    produce a ready inference state.
  - Local LLM installation establishes artifact and runtime availability; Model Lab evaluation
    remains a separate quality decision.
  - Interrupted operations rehydrate from durable core state and expose one recommended recovery
    action.
- Visual treatment:
  - Use asymmetric priority, restrained concentric surface depth, tabular progress figures, and
    functional transform/opacity motion.
  - Preserve the dense production-desk character; do not apply marketing-scale whitespace,
    decorative glass, or nested shells to every control.

## Accessibility

- Target standard: WCAG 2.2 AA for the Studio operator journey.
- Keyboard and focus behavior:
  - Every review, comparison, installation, and recovery action is keyboard operable.
  - Dialogs trap focus and restore it to the invoking control.
  - Canonical selections and progress changes are announced without stealing focus.
- Contrast and readability:
  - Body and status text meet AA contrast in every theme and palette.
  - Turkish glyphs remain complete and legible.
  - Critical explanation text is not reduced to badge-only or color-only meaning.
- Screen-reader semantics:
  - Use semantic forms, progress elements, lists, tables, headings, and live regions.
  - Provider state, download progress, and blockers have explicit text equivalents.
- Reduced motion and sensory considerations:
  - Reduced-motion mode removes decorative transitions and preserves state changes.
  - No flashing, high-frequency scanline, or persistent parallax effects appear in workspaces.

## Responsive behavior

- Supported breakpoints and devices: 1440×900 and 1280×800 desktop, 768×1024 tablet, and 390×844
  mobile acceptance sizes.
- Layout adaptations:
  - Desktop may use a navigation rail, main decision workspace, and evidence rail.
  - Tablet collapses evidence below the primary decision and keeps actions sticky within the content
    region.
  - Mobile becomes one column, removes overlap and rotations, preserves media controls, and moves
    Advanced evidence behind disclosure.
  - No horizontal page overflow is acceptable.
- Touch and hover differences:
  - Touch targets remain at least 44×44 CSS pixels where practical.
  - Hover enhancement is supplementary; selection, cost, readiness, and progress never depend on
    hover.

## Interaction states

- Loading: preserve the surrounding workspace and show labeled skeletons or real progress.
- Empty: explain what is absent, why it matters, and the next safe action.
- Error: state what failed, whether money or remote state may have changed, and the supported
  recovery options.
- Success: confirm the exact result and expose the next workflow action without celebratory
  distraction.
- Disabled: explain the missing prerequisite directly beside the control.
- Offline or slow network: distinguish local operation, provider network wait, resumable download,
  and remote processing wait.
- Long-running local work: show phase, elapsed time, progress when knowable, cancellation
  consequence, and whether the app may be safely left open.

## Content voice

- Tone: calm, exact, operator-oriented, scientifically careful, and candid about uncertainty.
- Terminology:
  - Use one selected locale throughout normal Studio surfaces.
  - Technical identifiers and provider product names remain exact.
  - Use “mock,” “manual input,” “local generation,” and “hosted generation” as distinct terms.
  - Never call configuration presence “ready,” credit “rights,” preview “production,” or upload
    transfer “processed.”
- Microcopy rules:
  - Lead with the operator consequence.
  - Use direct verbs for primary actions.
  - Explain blockers with a remedy when one exists.
  - Avoid security theatre, generic AI enthusiasm, and raw exception text.

## Implementation constraints

- Framework and styling system: Next.js App Router, React, Tailwind CSS, shadcn/Radix primitives,
  and `next-intl`.
- Design-token constraints:
  - Extend the established Studio tokens before adding new global variables.
  - Preserve theme, palette, density, and Turkish `latin-ext` behavior.
- Performance constraints:
  - Avoid backdrop blur on scrolling content and large surfaces.
  - Animate only transform and opacity for decorative transitions.
  - Keep server components responsible for local reads and client components focused on interaction.
  - Do not poll aggressively; long-running work uses bounded status refresh or streamed progress
    contracts.
- Compatibility constraints:
  - Studio remains a typed surface over shared core services and never owns a second workflow state
    machine.
  - Webpack remains the supported Studio build path for this roadmap.
  - Large local models are installed through Studio onboarding, not the base package install.
- Test and screenshot expectations:
  - Real production build for browser acceptance.
  - Chromium complete path and WebKit primary-path smoke.
  - Turkish and English, light/dark/system themes, supported viewport sizes, 200 percent zoom,
    reduced motion, keyboard navigation, and representative provider failures.
  - Visual baselines mask run identifiers and timestamps rather than hiding whole regions.

## Open questions

- None currently. New contradictions discovered during implementation must be added here before
  changing the design contract.
