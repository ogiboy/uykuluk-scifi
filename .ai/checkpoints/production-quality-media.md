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
- Completed commits:
  - `49e56ca1 chore(env): track encrypted dotenv vaults`
  - `3e972d75 refactor(voice): establish tts provider boundary`
  - `5084e166 feat(voice): add inspectable tts text preparation`
  - `5496633e feat(voice): add reserved ElevenLabs adapter`
  - `367a809f feat(voice): integrate approval-gated ElevenLabs synthesis`
- ElevenLabs now has server-only credential diagnostics, dynamic prepared-character pricing,
  exact provider/model cost binding, reservation/settlement execution, WAV validation, character
  alignment artifacts, redacted provenance, and tamper detection. No live paid call has run.
- Focused verification after integration: 71 tests passed across voice, cost, reservation, doctor,
  readiness, status, and render gates; TS 7 and TS 6 typechecks passed; modularity and secret scan
  passed; dependency audit reported no known vulnerabilities.

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

1. Add ElevenLabs voice preview candidates and durable operator selection before full synthesis.
2. Convert character alignment into a separate aligned SRT artifact and bind it into render approval.
3. Add scene-specific visual plan/manifest/review contracts without ComfyUI.
4. Select one hosted image provider through a bounded UykulukSciFi scene bake-off, then add its
   disabled-by-default reserved adapter.
5. Bind approved voice, aligned subtitles, and visual-manifest digests into render and expose the
   guided Studio flow.
6. Add deterministic motion/audio mastering and final thumbnail rendering.
7. Add private-only YouTube upload after local final review is reliable; keep public/scheduled
   publish disabled.
8. Update roadmap/current-state docs and complete PR-level gates.

## Blockers And Risks

- A hosted visual provider has not been selected; do not guess one or create provider sprawl.
- ElevenLabs TTS has no documented idempotency key; application operation IDs and reservation
  recovery must prevent blind duplicate generation.
- A settled provider call followed by a process crash before final artifact persistence still needs
  an explicit durable recovery/spool design; retries remain fail-closed meanwhile.
- Long-form subtitle alignment and chunk stitching need deterministic fixtures before live smoke.
- Heavy tests and concurrent agents can overload the local machine; keep heavy work sequential.
