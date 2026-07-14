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

- Studio exposes the complete brief/script-selection, source/claim review, voice audition,
  cost approval, production voice/aligned subtitle, visual review/regeneration, render review,
  private upload, and processing-review journey.
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

- Branch/worktree: `codex/voice-studio-aligned-srt` at
  `/Users/ogiboy/.codex/worktrees/63dc/uykuluk-scifi`, based on `origin/main` tag `v0.81.0`
  (`b88a30c3`).
- `v0.81.0` contains approval-bound ElevenLabs v3 catalog, preview, attributable selection,
  reselection, quote, reservation, synthesis, alignment, settlement, recovery, and redacted evidence
  with deterministic-local and Piper fallbacks. PR #146 and hosted CI/Sonar/CodeQL were green.
- No live paid synthesis has been validated. The configured free account may be used only for
  permitted read-only metadata/catalog/preview smoke; production-rights checks may not be bypassed.
- Character alignment is persisted and stitched. The active `v0.82.0` candidate adds aligned
  SRT/metadata and exact render consumers plus typed Studio candidate/preview/select/reselect and
  exact hosted-confirmation actions. Integration and real production-build Studio browser UAT pass;
  the work is not release-validated until remaining PR-ready gates and merge complete. Released
  `v0.81.0` still consumes package-time estimated subtitles and lacks this Studio audition surface.
- Visual prompts exist in scene artifacts, but render rotates static assets and has no
  `VisualProvider`. Private YouTube upload remains fail-closed placeholder behavior.
- Fresh pre-branch evidence from the same `v0.81.0` code: `pnpm qa:product` passed; focused stale
  compare-and-save tests passed; the default unbounded local Vitest worker count produced three
  intermittent five-second timeouts, while `maxWorkers=4` passed all 927 tests and CI-shaped
  `maxWorkers=2` with 15-second timeouts also passed all 927 tests.
- External global Codex closeout completed before this branch: AGENTS/agent model routing preserved,
  Ruflo marketplace registry repaired without removing plugins, security router verified 738
  archived skills plus pin/new-task/unpin smoke, Context7 Keychain JSON-RPC smoke passed, and OMX
  doctor/team checks are clean. Preserve `/Users/ogiboy/.codex/config.toml.backup-20260713-1845`.
- Stabilization is implemented and committed on this branch: local Vitest is bounded to four
  workers; Doctor and product copy no longer depend on mutable `voiceId`; ElevenLabs cost guidance
  requires a current persisted selection; and CLI/Studio evidence binds the live TTS requirement,
  exact four-artifact audition chain, catalog expiry, canonical config digest, and root-aware
  containment. Historical completed evidence is exempt from pre-spend catalog/config freshness. Spec
  and independent quality/security reviews passed. Two consecutive local full suites passed at 210
  files / 952 tests; the native and compatibility TypeScript lanes, lint, diff check, and 12 changed
  test files / 95 tests also passed for that stabilization checkpoint.
- The integrated voice candidate now passes 214 files / 991 tests twice locally, the same 214 / 991
  in CI mode, focused subtitle/render/voice/Studio suites, all four native/compatibility core and
  Studio TypeScript lanes at the implementation checkpoint, `studio:build`, `qa:usage`, `qa:product`,
  and `qa:browser` (9/9). Real browser UAT verified dashboard, run detail, local A/B selection,
  exact approval/binding/quote confirmation, local-only preview media, and a clean console; captures
  are committed under `docs/images/`.

## Decisions

- Active first slice is voice completion and Studio parity, not settings/provider expansion.
- Local Vitest uses four workers with the existing five-second fail-fast timeout. CI keeps two
  workers and 15-second test/hook timeouts.
- ElevenLabs original alignment is the timing authority; normalized alignment is diagnostic only.
  ElevenLabs production evidence without a valid aligned subtitle must not silently use linear
  fallback. Piper/deterministic-local retain explicit `linear-fallback` timing evidence.
- Studio hosted execution must echo the exact binding, quote, and approval identity visible to the
  operator; core revalidates all values before spend.
- Private upload is a v1 controlled-distribution deliverable. Public/scheduled publishing is not.
- Advanced settings/prompt history follows media quality. Only minimal versioned provider/model/
  budget settings may be introduced just in time before the first hosted visual call.
- ComfyUI, generic queues/team SaaS, multiple hosted visual adapters, and short clips remain out of
  scope until real episode evidence proves a need.

## Execution Readiness View

- Intent lock: finish the exact Studio-first production journey while preserving local fallback and
  fail-closed paid/external effects.
- Scope fence for the active PR: test stability, doctor/next-action truth, aligned subtitle evidence,
  exact render binding, guarded Studio voice audition/selection/reselection/production review, and
  roadmap/current-state/task/checkpoint reconciliation, plus the concise product README and initial
  versioned Markdown documentation migration. A hosted docs site remains deferred.
- Baseline lock: `origin/main` `b88a30c3` (`v0.81.0`); existing ElevenLabs operation spool,
  reservation, settlement, and selection evidence remain authoritative.
- Compatibility boundary: existing local runs remain readable through explicit linear subtitle
  fallback; no automatic compatibility fallback is permitted for incomplete/tampered paid evidence.
- Test obligations: focused producer/consumer regression, two consecutive local full suites,
  CI-shaped full suite, TypeScript native/compat, product/browser UAT, and PR-ready security/release
  gates.
- Review gate: spec compliance before code-quality review for each coherent implementation slice;
  no completion claim from unit tests alone.
- Drift/rewind rule: a new provider, state machine, unapproved paid call, public upload surface, or
  new persistent owner outside this checkpoint requires plan refresh before implementation.

## Remaining Work

Active `v0.82.0` candidate, PR closeout:

1. Rerun post-build type/lint/full checks, coverage, dependency, version, and Sonar Cloud gates.
2. Review the integrated diff, update changelog/release evidence, commit coherent slices, and open
   the voice-completion PR from `codex/voice-studio-aligned-srt`.
3. Keep commercial ElevenLabs synthesis explicitly unverified until an eligible account completes
   one exact quote/approval/reservation/settlement smoke outside CI.

Ordered slices after `v0.82.0`:

4. Visual production and exact render: add static/manual `VisualProvider`, run a three-scene hosted
   bake-off, integrate only the selected provider, and deliver 12-24 scene images, contact-sheet
   review, rejected-only regeneration, provenance/cost, deterministic motion, mastering, thumbnail,
   and exact media binding.
5. Script audition and editorial quality: add sequential candidates, side-by-side selection,
   streamlined review, operator-curated source/claim provenance, and the minimum-publishable
   scorecard.
6. Controlled distribution: add resumable private-only YouTube upload with target-channel and media/
   metadata/thumbnail/caption binding plus processing review; keep public/scheduled paths
   unreachable.
7. Productization and real proof: complete persistent settings/prompts, bootstrap/onboarding,
   stabilize documentation navigation and evaluate a docs site only after content settles, run the
   local fallback rehearsal and one approved commercial voice smoke, and complete two real episode
   acceptance runs.

## Active Resume Hint

- Current todo: finish PR-ready validation/review and merge the implemented voice-completion
  candidate; do not repeat already-green feature work unless a gate exposes a regression.
- Current evidence: 214 files / 991 tests passed twice locally and once in CI mode; focused
  producer/consumer tests, four typecheck lanes, production Studio build, usage/product/browser QA,
  and real browser UAT passed. Browser captures are under `docs/images/`.
- Explicit next-slice boundary: after PR closeout, begin the static/manual `VisualProvider` and exact
  render slice. Do not add multiple hosted adapters, ComfyUI, short clips, upload, or public publish.
- Next verification: fresh post-documentation typecheck/check, coverage, dependency/version, Sonar
  Cloud, then final diff review and PR creation.

## Blockers And Risks

- Free ElevenLabs access does not establish commercial production rights. Live synthesis remains
  blocked until account eligibility, exact quote, persisted approval, and reservation are all valid.
- The hosted visual provider is intentionally unselected; only the bounded bake-off may choose it.
- Heavy tests, browser runs, Sonar, and local model processes can overload the machine and must run
  sequentially.
- Codex currently reports a broad plugin-skill context-budget warning despite the completed security
  archive migration. Do not remove unrelated plugins during this product slice; treat broader plugin
  catalog pruning as a separate global maintenance decision.
