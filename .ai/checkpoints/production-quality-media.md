# Production Quality Media

## Objective

Turn the proven local production loop into a publish-quality, single-application media workflow.
Keep deterministic/Piper fallbacks, add an approval- and cost-gated ElevenLabs production path,
and make scene-specific visuals first-class without adding ComfyUI or enabling public publish.

## Completion Criteria

- Studio/core can select local or hosted TTS without duplicating workflow state.
- ElevenLabs credentials stay server-side and all paid calls use exact quote, reservation,
  settlement, redacted evidence, timeout, and retry boundaries.
- The approved render input binds voice, aligned subtitles, and scene-specific visual evidence.
- Static assets remain a safe fallback; one automatic visual provider can be added without changing
  workflow contracts.
- Each vertical slice has focused tests; full project/product/browser/security/release gates pass at
  PR readiness.
- Upload/public publish remain disabled in this workstream.

## Current State

- Branch/worktree: `feat/production-quality-media` at
  `/Users/ogiboy/.codex/worktrees/894d/uykuluk-scifi`.
- Base: `origin/main` at `489521e8` (`v0.80.3`).
- The existing loop has produced a real Gemma 3 12B -> Piper -> FFmpeg -> handoff episode.
- Current voice modes are `deterministic-local` and `local-piper`.
- Render plans persist scene `visualPrompt` values but rotate static background assets; no visual
  provider consumes those prompts yet.
- Worktree was clean at workstream start.

## Decisions

- ComfyUI is explicitly out of scope.
- The product remains local-first, not local-only: providers are replaceable engines behind core
  approvals, costs, evidence, and operator UX.
- Piper remains an offline preview/fallback path; ElevenLabs is the first production-quality hosted
  TTS provider.
- No live paid API call runs in CI or without explicit operator approval and credentials.
- Do not add multiple hosted visual providers at once; establish the contract and choose one using
  a bounded scene bake-off.
- Run focused verification per vertical slice and full gates once at PR readiness.

## Remaining Work

1. Extract the TTS provider contract while preserving deterministic/Piper behavior.
2. Add local text preparation and audio processing evidence.
3. Add ElevenLabs preview/synthesis/timing and exact cost execution.
4. Add scene-specific visual plan/manifest/review contracts without ComfyUI.
5. Bind approved media digests into render and expose the guided Studio flow.
6. Update roadmap/current-state docs and complete PR-level gates.

## Blockers And Risks

- A hosted visual provider has not been selected; do not guess one or create provider sprawl.
- ElevenLabs TTS has no documented idempotency key; application operation IDs and reservation
  recovery must prevent blind duplicate generation.
- Long-form subtitle alignment and chunk stitching need deterministic fixtures before live smoke.
- Heavy tests and concurrent agents can overload the local machine; keep heavy work sequential.
