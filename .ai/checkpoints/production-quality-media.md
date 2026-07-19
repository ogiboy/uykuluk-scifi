# Production Quality, Studio-First Operation & Controlled Distribution

## Objective

Continue UykulukSciFi Producer from `v0.81.0` to a Studio-first v1 that can compare and select
scripts, create and review production voice and scene-specific visuals, render an exact approved
MP4, upload it privately to the intended YouTube channel, and review processing without normal CLI
dependence. Preserve deterministic-local, Piper, static, and manual-import fallbacks. Public and
scheduled publishing remain unavailable.

CLI/core continues to own workflow state, transitions, approvals, cost reservations and settlement,
artifacts, evidence, and readiness. Studio is a guarded typed operator surface, never a second
workflow engine. Missing or stale approval, insufficient budget, unsafe configuration, tampered
evidence, provider uncertainty, or ambiguous paid execution must fail closed.

## Completion Criteria

- Studio exposes the complete brief/script-selection, source/claim review, voice audition, cost
  approval, production voice/aligned subtitle, visual review/regeneration, render review, private
  upload, and processing-review journey.
- Voice, aligned subtitle, visual, music/SFX, thumbnail, metadata, caption, and final media digests
  are bound into their exact approval/evidence owners.
- One hosted TTS path and one hosted still-image path remain replaceable providers behind the same
  quote, approval, reservation, bounded execution, settlement, provenance, and redaction rules.
- A credential-free local fallback reaches a reviewable MP4 without paid services.
- Two real episodes complete without source edits, hidden state repair, manual assembly, or normal
  CLI operation; public release remains manual.
- Each slice has focused regression evidence. PR-ready slices also pass full check, product/browser
  UAT, security/dependency, coverage, version, and Sonar Cloud gates. No paid live call runs in CI.

## Current State

- Repository checkpoint: `.ai/checkpoints/production-quality-media.md`; delivery audit branch
  `fix/delivery-proof` source `3e971d02` was merged to `origin/main` as `371e2b16`. Validation is
  reproducible from Git state plus this checkpoint, including portable JSON verification of the
  processed CircleCI quality graph and cache steps.
- `v0.82.0` released aligned Turkish SRT, exact render binding, and guarded Studio voice audition,
  selection, reselection, quote confirmation, production execution, and review. Deterministic-local
  and Piper remain available fallbacks.
- `v0.84.0` released the provider-neutral visual manifest/revision/review boundary, static/manual
  fallback, and an experimental disabled-by-default BFL FLUX.2 Pro adapter with quote, reservation,
  spool recovery, settlement, provenance, and rejected-only regeneration. It has mock-backed and CI
  evidence but no approved live paid bake-off.
- `v0.85.0` through `v0.85.3` released revisioned settings and episode briefs, the generated
  capability catalog, a parallel CircleCI quality graph, bounded Chunk profiles, and the final
  capability-routing documentation. The latest main quality gate completed in about 8m45s with warm
  pnpm, Next, and Sonar caches, merged two-shard JUnit/LCOV, one Webpack Studio build, 15 Playwright
  tests, SonarCloud, and CodeQL green.
- `CONTEXT.md` and `DESIGN.md` now hold the accepted V1 domain and Studio interaction contracts.
  They define MFLUX as the required local visual-generation capability while keeping mock and manual
  input visibly non-equivalent alternatives.
- Real commercial ElevenLabs production synthesis remains unverified. The bounded Free-plan v3
  diagnostic was attempted and rejected safely; it did not create production evidence.
- Private YouTube upload remains unavailable. Public and scheduled publishing remain unreachable.
- The active local visual slice is Studio-managed MFLUX readiness, resumable setup, local generation
  provenance, revision audition, and explicit canonical scene selection. Real install and smoke
  evidence are still pending exact operator approval outside CI.

## Decisions

- The active product slice is local-model readiness plus MFLUX generation and visual audition; it is
  implemented through the guarded Studio path and remains unproven on a real target machine.
- Local Vitest uses four workers with the existing five-second fail-fast timeout. CI keeps two
  workers and 15-second test/hook timeouts.
- ElevenLabs original alignment is the timing authority; normalized alignment is diagnostic only.
  ElevenLabs production evidence without a valid aligned subtitle must not silently use linear
  fallback. Piper/deterministic-local retain explicit `linear-fallback` timing evidence.
- Studio hosted execution must echo the exact binding, quote, and approval identity visible to the
  operator; core revalidates all values before spend.
- Private upload is a v1 controlled-distribution deliverable. Public/scheduled publishing is not.
- MFLUX is required for real credential-free local image generation. Missing MFLUX may expose mock
  diagnostics or manual input, but neither may claim local inference readiness.
- Local-model lifecycle belongs to a capability-oriented core service with a read-only overview and
  closed typed intents. Studio may never submit arbitrary URLs, commands, paths, or runtime flags.
- Existing visual manifest, revision, review, provenance, and exact render consumers remain the
  canonical media owners. Local setup and generation must extend them rather than create a second
  workflow engine.
- ComfyUI, a second local image adapter, another hosted provider, short clips, and generic queues
  remain out of scope until real episode evidence proves a need.

## Execution Readiness View

- Intent lock: finish the exact Studio-first production journey while preserving local fallback and
  fail-closed paid/external effects.
- Scope fence for the current product slice: local capability overview, curated MFLUX
  install/verify/recovery, sequential local image generation, visual revision comparison and
  activation, guarded Studio actions, and focused contract evidence. Processed-CircleCI validation
  remains portable and JSON-verifiable; it is delivery evidence, not local-model execution proof.
- Baseline lock: `origin/main` `371e2b16` (post-`v0.85.3` delivery-proof merge). Existing voice and
  hosted visual operation, spool, reservation, settlement, manifest, revision, and render evidence
  remain authoritative.
- Compatibility boundary: static/manual and BFL visual revisions must remain readable. Local MFLUX
  adds provenance and candidates without reusing hosted cost semantics.
- Test obligations: focused core and Studio contracts locally; typecheck/lint and browser smoke at
  the integration checkpoint; full sharded unit, product, browser, Sonar, and dependency work once
  in CircleCI.
- Review gate: spec compliance before code-quality review for each coherent implementation slice; no
  completion claim from unit tests alone.
- Drift/rewind rule: a new provider, state machine, unapproved paid call, public upload surface, or
  new persistent owner outside this checkpoint requires plan refresh before implementation.

## Remaining Work

1. Run the real MFLUX setup/verify and bounded 1024x576 smoke on the target machine only after
   Studio presents the exact no-cost preflight covering estimated cost, time, and disk use
   (including the 6.5 GB conservative setup estimate) and an identified operator explicitly approves
   its binding digest. Persist durable QA and security evidence for every attempt under
   `runs/<run_id>`; keep the real execution outside CI and distinguish it from mocked worker,
   offline-manifest, and browser/contract evidence.
2. Finish exact render/media quality: 12-24 accepted scene images, deterministic motion, subtitle
   readability, mastering, licensed music/SFX provenance, and final thumbnail JPG.
3. Add script audition and editorial quality: sequential candidates, side-by-side selection,
   streamlined review, operator-curated source/claim provenance, and the minimum-publishable
   scorecard.
4. Add controlled distribution: resumable private-only YouTube upload with target-channel and media/
   metadata/thumbnail/caption binding plus processing review; keep public/scheduled paths
   unreachable.
5. Complete productization and real proof: settings/prompt rollback, onboarding, documentation,
   stabilize documentation navigation and evaluate a docs site only after content settles, run the
   local fallback rehearsal and one approved commercial voice smoke, and complete two real episode
   acceptance runs.

## Active Resume Hint

- Current todo: execute the exact operator-approved MFLUX setup/verify/smoke outside CI, then record
  model/runtime identity, install-manifest verification, measured duration, and durable QA/security
  evidence under `runs/<run_id>`. Preserve static/manual/BFL revisions and do not add another
  provider, video generation, upload, or public publishing.
- Current evidence: focused local-model, worker-boundary, visual-generation, and Studio contract
  tests plus portable JSON verification of the processed CircleCI config. These do not prove a real
  install or generation smoke.
- Next verification: target-machine preflight approval, real setup/verify, bounded smoke, and
  evidence/readiness review; then exact render/media quality and real-episode acceptance.

## Blockers And Risks

- Free ElevenLabs access does not establish commercial production rights. Live synthesis remains
  blocked until account eligibility, exact quote, persisted approval, and reservation are all valid.
- BFL remains experimental until a three-scene live quality/cost bake-off passes its rubric.
- MFLUX `0.18.0`, the pinned model revision, and the locked `uv` project were confirmed from current
  official sources. Reconfirm them only when upgrading; do not invent flags or download URLs.
- Heavy tests, browser runs, Sonar, and local model processes can overload the machine and must run
  sequentially.
- Codex currently reports a broad plugin-skill context-budget warning despite the completed security
  archive migration. Do not remove unrelated plugins during this product slice; treat broader plugin
  catalog pruning as a separate global maintenance decision.
