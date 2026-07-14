# Visual Provider Manual Fallback — Intent

## Slice Card

- Goal: deliver a Studio-first static/manual visual workflow whose approved media is bound into the
  exact render contract.
- Parent plan/spec: `.ai/checkpoints/production-quality-media.md` and the active v1 goal.
- Files: `src/stages/visuals/**`, render approval/evidence owners, Studio visual routes/components,
  focused tests, and checkpoint documentation.
- Boundary: static/manual fallback only. No hosted provider, ComfyUI, clips, upload, public
  publishing, or generic workflow framework.
- Verification: focused visual/render/Studio tests, native and compatibility typecheck, full project
  gates at PR readiness, and real Studio browser UAT.
- Stop: a reviewable contact sheet and per-scene decision flow works in Studio; approved visual
  manifest/digests are required by render approval and execution; the branch is review-ready in at
  most 150 changed files.

## Baseline Read Set

- `.ai/checkpoints/production-quality-media.md`
- `.ai/tasks.instructions.md`
- `src/stages/visuals/**`
- `src/stages/renderPlan.ts`
- `src/stages/approveRender.ts`
- `src/stages/render/**`
- Studio typed action and mutation owners under `apps/studio/src/lib/**`
- Existing visual/render tests

## Impact And Constraints

The slice adds the first visual workflow owner and changes exact render approval inputs. Existing
local runs remain readable, but a new render may not silently omit the active approved visual
manifest. CLI/core remains the state/evidence owner; Studio only calls typed guarded actions.

TDD Route: `Mode: off / Decision: skipped`. Existing tests and proportional regression coverage are
the authority; strict red-green sequencing was not requested.

## Change Necessity

- User-visible need: operators currently cannot prepare, import, review, reject, or regenerate
  episode visuals without manual assembly.
- No-change option: continuing static asset rotation cannot satisfy the 12–24 episode-specific image
  or exact approval requirements.
- Why code is necessary: new persisted visual artifacts, decisions, and render bindings require
  explicit core and Studio contracts.
- Minimum boundary: one static/manual provider boundary, one manifest/review owner, deterministic
  motion descriptors, and exact render consumers.
- Decision: code-change.

## Execution Readiness View

- Intent lock: Studio-first visual review with local fallback and exact render binding.
- Scope fence: static/manual visuals, contact sheet, decisions/revisions, deterministic motion,
  render contract, Studio surface.
- Baseline lock: branch `codex/visual-provider-manual-fallback` at `9faa4d11`, with PR #149 merged
  separately into `origin/main`.
- Owner constraints: core owns state/artifacts/evidence; Studio is a typed client.
- Compatibility: old runs may be inspected; new render execution must not invent missing approved
  visual evidence.
- Test obligations: focused tests, typechecks, build/UAT, then full PR gates.
- Review gates: spec review, then code-quality review, then final integration review.
- Drift rule: a hosted provider, paid call, new workflow state machine, or upload/publish surface
  requires a separate plan.
