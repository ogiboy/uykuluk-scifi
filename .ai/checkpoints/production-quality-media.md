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

- Branch/worktree: `feat/elevenlabs-v3-voice-selection` at
  `/Users/ogiboy/.codex/worktrees/63dc/uykuluk-scifi`.
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
  - `97ee13e6 chore(env): prepare ElevenLabs local credentials`
  - `0dfa07d7 feat(voice): support long-form Eleven v3 synthesis`
  - `2dea4aaa docs(roadmap): plan controlled production settings`
  - `179fac2f feat(voice): add redacted ElevenLabs candidate catalog`
  - `c5fef8c8 feat(voice): add audition previews and selection evidence`
- ElevenLabs now has server-only credential diagnostics, dynamic prepared-character pricing,
  exact provider/model cost binding, reservation/settlement execution, WAV validation, character
  alignment artifacts, redacted provenance, and tamper detection. No live paid call has run.
- Focused verification after integration: 71 tests passed across voice, cost, reservation, doctor,
  readiness, status, and render gates; TS 7 and TS 6 typechecks passed; modularity and secret scan
  passed; dependency audit reported no known vulnerabilities.
- Eleven v3 follow-up verification: 108 focused tests passed across voice/config/cost/reservation,
  plus TS 7/TS 6 typechecks, targeted lint, and secret scan. The adapter now chunks long Turkish
  scripts within the v3 request cap, stitches canonical PCM16 WAV/alignment data, reconciles raw
  provider character cost, retains the last provider request id on uncertain failure, and keeps
  blind retry disabled. No live provider call ran.
- Operator-created ignored `producer.config.json` uses `eleven_v3`; local `.env` files contain the
  configured server-only key. Tracked `.env.vault` and `apps/studio/.env.vault` ciphertext changes
  are operator-owned and must not be staged without explicit intent.
- `producer voice-candidates` now performs bounded read-only account-voice/model/subscription calls
  after package generation and persists only normalized hashes/classifications. A live read-only
  smoke on 2026-07-12 returned 21 preview-capable voices, including 2 Turkish-verified candidates;
  no raw URL or request ID survived serialization, and all voices were correctly `preview-only` on
  the current free subscription. No TTS request ran.
- Catalog-slice verification: 94 focused voice/cost/reservation/readiness tests, TS 7 and TS 6,
  targeted ESLint, modularity, formatting, and secret scan passed. The live model reported Turkish
  TTS support, 5,000 characters/request, no Speaker Boost, and 1x model/discount multipliers.
- The next local audition slice now adds canonical digest verification, model-exact Turkish ranking,
  free-form metadata redaction, bounded operation deadlines, conflicting-duplicate rejection,
  account/tier checks, redirect-free 5 MiB preview download, tamper-checked local evidence,
  attributable selection, prior-selection archive, and explicit paid-tier production-rights
  confirmation. No preview URL can enter through CLI input and no synthesis call occurs.
- Audition-slice verification passes 62 focused tests across catalog/provider/download, stage/store
  tamper and concurrency cases, and CLI selection; TypeScript 7/6, targeted ESLint, Prettier,
  modularity, secret scan, and diff-check also pass. Spec and code-quality reviews approved the
  contract/store/persistence split after dot-segment, legacy-failure scoping, and trimmed-input
  negative cases were added. No live TTS request ran.
- Exact production binding is now implemented end to end. The selected voice snapshot drives the
  quote, operator-readable approval summary, reservation, quote-bound operation id, provider
  construction, live metadata preflight, synthesis, settlement, and final evidence. Config
  `voiceId` remains only a candidate hint. Expected discounted pricing and the conservative
  per-chunk maximum are separate; provider-reported billable credits settle once against the
  approved base tariff.
- Paid output is committed to an operation spool whose digest is anchored in reservation and cost
  settlement evidence. Simulated failures after result commit and after settlement both recovered
  without a second TTS request, current API key, live metadata refresh, enabled current config, or a
  fresh catalog. Final audio and alignment must match the pinned spool. Successful chunks preserve
  hashed request ids, text digests, and provider-reported credits; partial uncertain execution keeps
  redacted request evidence for reconciliation.
- Pre-spend reselection is serialized against cost reservation, archives every registered selection
  plus digest/byte quote evidence, invalidates the exact cost approval, and reopens selection.
  Active, uncertain, or settled TTS reservations block it; a provider-proven `RELEASED` non-send is
  durably no-send and permits recovery only through a fresh selection, quote, and approval.
- The shared local orchestrator now has a fake-binary Piper success regression proving canonical WAV
  and provenance without selection, preflight, reservation, or paid evidence. Vitest blocks all
  non-loopback fetch/socket traffic so mocked paid tests cannot silently become live calls.
- Current focused verification: 187 voice, ElevenLabs, Piper, cost, reservation, readiness, and
  network-guard tests pass; native TypeScript 7 and compatibility TypeScript 6 checks pass. No live
  paid call ran.
- PR hardening is in progress against the approved 2026-07-13 delivery plan. Unrelated Studio
  dependency patch bumps and lockfile formatting churn were restored to `HEAD`; the two model
  directory placeholders are deferred in the named stash
  `defer model directory placeholders after voice PR`. CodeRabbit findings are being revalidated
  and fixed only when they match current contracts; no paid provider call, Docker service, upload,
  or publish action is authorized in this pass.

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
- Persistent Studio settings use approved command-boundary semantics: successful saves are visible
  immediately and apply to the next command, while in-flight work retains an immutable starting
  snapshot. Listener ports and build-time env changes require controlled restart/rebuild; secrets
  remain env-only.

## Remaining Work

1. Convert character alignment into a separate aligned SRT artifact and bind it into render approval.
2. Implement the approved versioned config/prompt-profile design and guarded Studio surfaces, then
   add the idempotent one-command local bootstrap.
3. Add scene-specific visual plan/manifest/review contracts without ComfyUI.
4. Select one hosted image provider through a bounded UykulukSciFi scene bake-off, then add its
   disabled-by-default reserved adapter.
5. Bind approved voice, aligned subtitles, and visual-manifest digests into render and expose the
   guided Studio flow.
6. Add deterministic motion/audio mastering and final thumbnail rendering.
7. Add private-only YouTube upload after local final review is reliable; keep public/scheduled
   publish disabled.
8. Complete two real episodes without source edits, hidden repair, or manual assembly, then run
   PR-level gates.

## Active Resume Hint

- Active slice: finish the approval-bound ElevenLabs v3 branch, keep the final PR below CodeRabbit's
  150-file ceiling, run the full PR-ready gates, and open the reviewed PR before changing global
  Codex configuration.
- Next action after PR creation: modernize the global agent/model routing, Context7 secret launch,
  and hybrid defensive-security skill catalog, then return here for aligned SRT work.
- Drift guard: do not widen this PR into Studio settings, visual providers, aligned SRT, live paid
  synthesis, upload, or public/scheduled publishing.

## Blockers And Risks

- A hosted visual provider has not been selected; do not guess one or create provider sprawl.
- ElevenLabs TTS has no documented idempotency key; application operation IDs and reservation
  recovery must prevent blind duplicate generation.
- Long-form subtitle alignment and chunk stitching need deterministic fixtures before live smoke.
- The paid path remains mock-verified only. The first live synthesis still requires explicit
  operator approval, a small quote, current eligible account metadata, and post-call evidence review.
- Config/example/env drift is confirmed: CLI and Studio can resolve `PRODUCER_CONFIG` differently,
  stale Ollama env names are unused, and code/template defaults differ. Fix this through the
  approved config owner rather than piecemeal Studio JSON writes.
- Heavy tests and concurrent agents can overload the local machine; keep heavy work sequential.
