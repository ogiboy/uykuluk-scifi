# Hosted Visual Provider — Intent

## Slice Card

- Goal: add one hosted still-image provider to the existing Studio-first visual workflow while
  preserving static/manual fallback and exact render binding.
- Parent plan/spec: `.ai/checkpoints/production-quality-media.md`, `.ai/tasks.instructions.md`, and
  the active v1 goal.
- Files: visual provider/execution owners, cost binding and quote owners, Studio visual actions and
  components, focused tests, and product/checkpoint documentation.
- Boundary: FLUX.2 Pro only. No second hosted provider, ComfyUI, clips, private upload, public
  publishing, generic queue, or broad settings editor.
- Verification: mocked request/poll/download/recovery/settlement tests, visual/render/local fallback
  regressions, native and compatibility typecheck, Studio build/UAT, and PR-ready full gates.
- Stop: an operator can quote, approve, generate, review, and selectively regenerate hosted scene
  images in Studio; every paid result is locally persisted with provenance and exact cost evidence;
  static/manual fallback still reaches render without credentials.

## Baseline Read Set

- `.ai/checkpoints/production-quality-media.md`
- `.ai/tasks.instructions.md`
- `docs/aegis/work/2026-07-14-visual-provider-manual-fallback/**`
- `src/stages/visuals/**` and `src/stages/visuals.ts`
- `src/costs/costQuoteStages.ts`, `costBindingSummary.ts`, reservation/execution/settlement owners
- render-plan and FFmpeg visual path owners
- Studio typed visual action and mutation owners
- official BFL OpenAPI and integration/pricing documentation

## Impact And Constraints

The slice introduces one paid visual boundary and therefore must reuse the existing exact quote,
approval, reservation, operation identity, bounded execution, settlement, and redacted evidence
owners. The provider response is asynchronous; the returned provider task identity and polling URL
must be persisted before polling. Unknown submit outcomes may not be retried blindly. Temporary
signed result URLs are server-side transport only and never become client or durable evidence.

TDD Route: `Mode: off / Decision: skipped`. Strict TDD was not requested. The implementation uses
focused regression-first tests and integration/UAT verification.

## Change Necessity

- User-visible need: Studio cannot yet generate episode-specific hosted visuals or selectively
  regenerate rejected scenes.
- No-change option: static/manual import preserves fallback but cannot satisfy the hosted visual v1
  requirement.
- Why code is necessary: provider execution, quote binding, recovery, settlement, and provenance
  require explicit persisted contracts.
- Minimum boundary: one FLUX.2 Pro adapter plus exact plan/binding/spool owners and thin Studio
  actions over the existing visual manifest.
- Decision: code-change.

## Execution Readiness View

- Intent lock: one production still-image adapter behind the same evidence/cost discipline as TTS.
- Scope fence: FLUX.2 Pro generation, quote/approval/execution/recovery, visual revisions,
  rejected-only regeneration, and Studio controls.
- Baseline lock: `origin/main` merge `149095d7` (PR #151), where static/manual visual workflow and
  exact render binding are green.
- Owner constraints: CLI/core owns state, artifacts, approvals, costs, and evidence; Studio calls
  typed guarded services only.
- Compatibility: legacy/static/manual runs remain readable and credential-free; hosted evidence may
  not silently fall back to static media.
- Retirement boundary: no temporary second provider or generic provider registry is introduced.
- Test obligations: focused provider/cost/recovery/render/Studio tests, local fallback rehearsal,
  typechecks/build/UAT, then full PR gates.
- Review gates: spec compliance, code quality, final integration review, hosted CI/Sonar/CodeQL.
- Drift rule: a second provider, new workflow state machine, clips, upload, or public distribution
  returns to plan review.
