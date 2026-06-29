# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree without making `.ai/` part of runtime execution.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep `pnpm qa:product` passing before broad production-loop PRs or merge-adjacent handoff; it is
  the optional product UAT gate for happy-path, malicious, stale, tampered, and publish-blocked
  local workflows plus manual analytics import/report feedback, durable render decisions, and Studio
  read-only service visibility.
- Keep visual asset inventory and the read-only Studio `/assets` page current.
- Keep content and asset guard coverage aligned with the operator checklist.
- Keep `apps/studio` thin until shared service contracts exist.
- Keep first-push repo hygiene files and GitHub workflows passing.
- Keep direct provider/publish guard coverage and CI dependency audit passing.
- Keep release planning, changelog, package version, and stable git tag automation passing on
  `main`; feature branches should not manually bump `package.json`.
- Keep release workflow contract tests aligned with the main-only bot guard, dependency audit,
  release validation, version planning, changelog mutation, and atomic tag push wiring.
- Keep roadmap priority focused on the real local production loop, not additional unused
  infrastructure abstractions.
- Keep script review, warning acknowledgement, approval, and packaging bound to one exact content
  digest.
- Keep script review Markdown approval guidance synchronized with the enforced warning/blocker
  gates.
- Keep script revision snapshots, attribution, state rollback, and approval invalidation passing.
- Keep provider-backed generation behind per-video, daily, and weekly budget preflight.
- Keep future paid-generation quotes bound to exact package/config/pricing digests and require an
  exact matching approval above the configured threshold.
- Keep production-package generation, cost estimation, readiness, and evidence bound to one strict
  manifest covering every derived package artifact and the approved script digest.
- Keep atomic reservation, one-time quote-line consumption, active-reservation budget accounting,
  recoverable settlement, and explicit reconciliation passing.
- Keep future nonzero provider callbacks behind adapter identity matching, durable execution claim,
  local at-most-once dispatch, bounded timeout, and fail-closed outcome classification.
- Keep local LLM generation fail-closed when models return malformed JSON, English operator-facing
  text, repeated/weak ideas, malformed labels, or incomplete scripts.
- Keep idea and script provider failure diagnostics safe, raw-output-free, and state-preserving.
- Keep local-model script diagnostics and receipts complete enough to diagnose which draft or
  expansion chunk failed.
- Keep readiness diagnostics, production-loop next actions, and evidence synchronized with persisted
  run state.
- Keep evidence next-command guidance synchronized with current approval gates and review blockers.
- Keep `producer status` operator-readable while preserving `--json` for raw state automation and
  `--summary-json` for enriched operator-status automation; approval ledger and warning details
  should stay visible in the default operator output. Missing, malformed, or stale evidence must
  label production media rows as artifact-record fallback rather than review proof, and the shared
  production-media `Review:` guidance should stay consistent across CLI status, evidence Markdown,
  and Studio.
- Keep `producer desk` as an Ink-based operator surface over CLI/core status contracts. It may make
  review and next-action navigation easier with readiness attention, blocked actions, production
  media review commands, render decisions, and read-only workflow progress, but it must not become a
  second workflow engine or bypass approval/cost/evidence gates.
- Keep `producer decide render` as local review evidence only. Render decisions must require a valid
  rendered draft, persist reviewer/notes/decision evidence, and never imply upload or publish
  approval. Status, the operator desk, and product UAT should surface the recorded decision and next
  safe action.
- Keep all run-root filesystem access behind canonical bounded run-ID validation.
- Keep run artifact reads, writes, and persisted lists behind canonical relative-path validation.
- Keep state, ledger, cost, reservation, lock, and artifact access behind canonical
  existing-component symlink containment.
- Keep final protected files fail-closed when their filesystem link count indicates another pathname
  shares the same inode.
- Keep the capability inventory current when plugin/MCP versions or project phases materially
  change.
- Keep long-running goals resumable from Git state and `.ai/checkpoints/`, not chat history alone.

## Next

- Harden the Render Plan + Contact Sheet MVP with operator review refinements only where real use
  exposes gaps; the current contact sheet already includes review gates, safe next commands,
  revision guidance, and blocked upload/publish actions. `producer review render-plan` now prints a
  read-only validated handoff for the contact sheet, asset provenance, timing, scene count, and
  still-blocked actions. Do not turn it into render execution.
- Harden local TTS with continued Piper voice-quality QA. Keep models and generated audio ignored;
  the current implemented foundation is deterministic reference WAV, operator audio review Markdown,
  optional configured `local-piper` shell-out, pinned Turkish model setup into ignored `models/`,
  provider model/config digest provenance, local smoke evidence, and `producer doctor`
  setup/remediation next actions. Evidence/readiness/status now mark deterministic-local WAVs as
  timing/reference only, and next-action guidance limits render approval with that audio to local
  timing drafts. `producer review voice` now prints the validated local audio review handoff before
  render approval, and Studio production-media rows surface the same command read-only. Keep the
  listen-before-render decision boundary explicit.
- Harden FFmpeg draft render visual polish; the current foundation is exact-approval-gated local MP4
  with intro/outro source-card bookends or source-frame sequences, scene-timed background plates,
  subtitle burn-in, lower-third, popup-card, waveform, watermark overlays, render manifest evidence,
  source-frame cadence, render approval ID/reference plus voiceover mode/quality/candidate
  classification preserved from approval through evidence, fail-closed `ffprobe` media validation,
  stable read-only FFmpeg review command evidence, and an operator-readable
  `production/render/draft_review.md` checklist plus render/review CLI handoffs with local-only
  decision guidance surfaced through CLI status, evidence Markdown, and read-only Studio panels.
- Use `producer eval local-model` before more Qwen-specific tuning. Compare configured local
  candidates through the same idea/script gates, receipt evidence, JSON compliance, repetition
  checks, Turkish label discipline, and operator quality review. Prefer eval-only CLI overrides for
  one-off bake-offs and `producer eval local-model-candidates` for same-runtime candidate
  comparisons so the project config does not churn between local model tests. Candidate comparison
  reports should keep surfacing deterministic recommendations and next operator commands without
  editing config. `llama.cpp` support is the local OpenAI-compatible runtime path for this work;
  live model runs remain manual/local and outside CI.
- Preserve Qwen/Ollama regressions as known-bad safety evidence. Current blockers reject repeated
  fit frames, generic boilerplate, repeated uncertainty openers, generic unknown-species phrasing,
  weak premise action frames, English scientific leftovers, malformed labels, repeated sentence
  loops, and underfilled long-form drafts. Do not weaken these blockers just to make one model pass.
- Preserve the continuation design over simply raising local section chunk caps; live local QA
  showed larger chunks can destabilize JSON parse reliability.
- Keep continuation request schemas compatible with Ollama grammar limits; large accepted-text
  bounds belong in parser validation, not provider grammar schemas.
- Keep `producer doctor` config/provider/model/TTS/render-toolchain/asset/publish diagnostics and
  evidence passing.
- Keep the read-only Studio home doctor summary and `/doctor` route aligned with persisted
  `producer doctor` JSON/Markdown artifacts, including malformed or missing diagnostics states and
  safe remediation commands. They must not run doctor, edit config, start providers, download
  models, or mutate workflow state.
- Keep the read-only Studio home latest-run readiness summary aligned with `listStudioRuns()` and
  persisted readiness/evidence artifacts. It must not duplicate workflow state or trigger CLI work.
- Keep the read-only Studio home manual analytics summary aligned with
  `getStudioAnalyticsOverview()` and local analytics artifacts. It must not call YouTube APIs or
  infer causality from incomplete imports.
- Keep Studio read-only artifact previews useful as new artifact types are added. Current previews
  include operator-phase grouping, media-specific metadata, and per-artifact review wording while
  keeping the surface non-mutating.
- Keep Studio read-only prompt inventory and `/prompts` route aligned with prompt defaults and local
  override safety. Prompt source/status visibility is allowed; editing, diff approval, rollback,
  provider calls, and prompt revision history remain future work.
- Keep Studio read-only local model evaluation summaries aligned with ignored
  `diagnostics/local_model_eval.*` and `diagnostics/local_model_candidates_eval.*` artifacts. Studio
  may show parser-contract evidence and next safe CLI commands, but must not call local models, edit
  provider config, generate runs, or weaken fail-closed provider checks.
- Keep Studio evidence panels conservative: missing, malformed, or stale evidence must point back to
  `producer evidence --run <run_id>` and must not imply blocked actions are absent or media is
  review-proof.
- Keep CLI status evidence panels equally conservative: production media rows may fall back to
  artifact records for visibility, but the text must say they are not current evidence proof and
  reuse the shared production-media review guidance.
- Keep the read-only Studio mutation-service status panel aligned with route-security and service
  contract changes; it must not become an approval form or route handler.
- Harden manual analytics feedback with import edge cases and richer comparisons while keeping data
  operator-provided and local-only. Run-linked summaries, unmapped-record visibility, non-causal
  repeat / avoid-without-revision / mixed-signal inspect / test-next prompts, simple
  confidence/missingness framing, a fillable run-link CSV template for missing `run_id` values, and
  the shared CLI/Studio import data-quality summary plus read-only Studio analytics overview with
  report freshness summaries are implemented.
- Maintain typed Studio mutation service contracts that both CLI and web can use before adding
  Studio mutations. Current contracts cover future idea/script/cost/render approvals plus disabled
  upload/publish actions; concrete CSRF/session handling and route implementations remain deferred.
- Keep local prompt overrides safe before adding a prompt editor. Tracked `prompts/defaults/`
  runtime defaults, typed keys, source paths, and prompt hashes are implemented; ignored
  `prompts/local/*.md` overrides are now explicit `producer.config.json` inputs and must remain
  provenance-recorded, local-only, and fail-closed outside `.ai/`.
- Keep package artifact revision events safe. `producer revise package-artifact` now supports
  bounded edits to subtitles, scenes, popup-card package Markdown, and YouTube metadata only while
  the run is still `PRODUCTION_PACKAGE_GENERATED`; it snapshots before/after content, refreshes the
  production-package manifest, invalidates stale evidence/readiness/render-plan artifacts, and
  records revision evidence. Future work can extend this to richer editor UX and per-field diffs
  without weakening the cost/render approval boundary.
- Maintain route security requirements before any web action routes exist; current tests cover
  read-only page routes, disabled future action routes, and absence of App Router `route.ts`
  handlers, and bind each disabled action route to a shared service contract.
- Keep the internal reserved-provider execution contract ready for a separately approved real
  adapter without adding paid SDKs, credentials, or operator execution commands.

## Later

- Repeat live local-model QA only after provider, prompt, model-setting, or evaluation-harness
  changes justify the time cost.
- YouTube Analytics API only after manual analytics import/reporting proves useful.
- Private YouTube upload behind upload approval and explicit config.
- Public/scheduled publish only after separate risk review.

## Do Not Do Yet

- Do not implement Studio mutations before shared service contracts, route security requirements,
  and negative tests exist.
- Do not add paid APIs.
- Do not add paid/generative media providers before deterministic local planning, TTS, and render
  flows are useful.
- Do not implement upload or publish.
- Do not create a second state machine in frontend code.
- Do not infer approvals from files or readiness output.
