# Task Backlog

## Now

- Keep CLI/core contracts stable.
- Keep `.ai/` guidance aligned with the source tree without making `.ai/` part of runtime execution.
- Keep `pnpm qa:usage` passing after workflow changes.
- Keep `pnpm qa:product` passing before broad production-loop PRs or merge-adjacent handoff; it is
  the optional product UAT gate for happy-path, malicious, stale, tampered, and publish-blocked
  local workflows plus manual analytics import/report feedback, guarded Studio workflow and
  analytics actions, operator desk command/diagnostic visibility, durable render decisions, and
  Studio read-only service visibility.
- Keep visual asset inventory and the read-only Studio `/assets` page current.
- Keep content and asset guard coverage aligned with the operator checklist.
- Keep `apps/studio` thin until shared service contracts exist.
- Keep first-push repo hygiene files and GitHub workflows passing.
- Keep native TypeScript 7 and TypeScript 6 compatibility checks passing; remove the compatibility
  lane only after parser-based tooling officially supports the TypeScript 7 JavaScript API.
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
- Keep idea originality enforcement tied to runtime artifact history: previous generated or approved
  titles should remain compact prompt context and same-title hard blockers without script bodies,
  `.ai` dependencies, or a required vector database.
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
  media review commands, safe run diagnostics, copyable operator commands, render decisions, and
  read-only workflow progress, but it must not become a second workflow engine or bypass
  approval/cost/evidence gates.
- Keep `producer decide render` as local review evidence only. Render decisions must require a valid
  rendered draft, persist reviewer/notes/decision evidence, and never imply upload or publish
  approval. Status, the operator desk, and product UAT should surface the recorded decision and next
  safe action.
- Keep Studio local approval/review mutations guarded: idea/script/cost/render approvals and
  `producer decide render` may be exposed only through same-origin JSON routes that call the
  matching CLI/core contract, require short-lived local session proof, write durable local evidence,
  and never bypass approval/cost/evidence gates.
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

- Maintain the merged aligned-SRT/render-binding and guarded Studio voice flow without weakening
  deterministic-local/Piper `linear-fallback` timing or making a paid CI call.
- Keep live ElevenLabs production validation separate from implementation completion. Free-tier
  metadata/catalog/preview smoke is allowed only where the provider permits it and never proves
  production rights. Production synthesis requires commercial eligibility, exact quote, persisted
  approval, reservation, bounded execution, and settlement; until then report it as pending.
- Preserve the merged `v0.83.0` static/manual visual fallback and exact render binding.
- Close the active FLUX.2 Pro slice: exact scene-plan quote/approval/reservation, bounded async
  execution, provider credit settlement, durable local spools, Studio confirmation, rejected-only
  quote/plan archival, combined voice recovery, product/browser UAT, and PR gates. Live BFL proof
  remains a separately approved smoke; static/manual stays credential-free.
- Then harden exact render/media quality: pacing and motion, subtitle readability, popup density,
  audio mastering, licensed music/SFX evidence, and final thumbnail JPG.
- Then add sequential multi-model script audition and editorial quality: immutable shared brief and
  prompt/settings snapshots, side-by-side selection, retained alternatives, inline review, operator-
  curated source/claim provenance, and a minimum-publishable scorecard.
- Then implement resumable private-only YouTube upload with server-side OAuth/session state, exact
  target-channel and MP4/metadata/thumbnail/caption digest binding, durable
  operation/offset/remote-ID evidence, and processing review. Public and scheduled publishing remain
  unavailable at schema, action-catalog, and UI levels.
- Productization follows media and controlled distribution: implement versioned settings/history/
  rollback, prompt profiles and editable idea briefs, one-command bootstrap/onboarding, concise
  product documentation, local fallback rehearsal, and two real-episode acceptance runs. Saves are
  visible immediately and affect the next command; in-flight work remains snapshot-pinned, secrets
  remain status-only, and listener/build-time settings require restart or rebuild.
- Treat Production Quality & Controlled Distribution as the active product milestone. Repeat the
  complete documented idea-to-manual-handoff workflow on real episodes and record operator/media
  friction; do not add a new platform surface unless the run exposes a concrete blocker.
- Keep the live local-model result honest: Gemma 3 12B on managed llama.cpp completed one real
  long-form run, but still required bounded continuation and attributable script/package review.
  Preserve Qwen failures as regression evidence and keep local model QA outside CI.
- Keep `producer revise render` as the only supported backtrack from a non-accepted or invalid
  `RENDERED` draft. Preserve archived MP4/manifest/decision evidence, invalidate the old render
  approval, and require regenerated evidence/readiness plus a fresh exact approval; never instruct
  operators to edit `state.json`.
- Maintain the guarded Studio `render.revise` route for normal non-accepted drafts. Attributed
  invalid-evidence recovery and richer manual handoff review remain CLI fallback until a dedicated
  typed form is added through the same route-security/service-contract boundary. CLI/core remains
  authoritative.

- Harden the Render Plan + Contact Sheet MVP with operator review refinements only where real use
  exposes gaps; the current contact sheet already includes review gates, safe next commands, visual
  rhythm checks, timing ranges, asset role counts, background reuse, revision guidance, and blocked
  upload/publish actions. `producer review render-plan` now prints a read-only validated handoff for
  the contact sheet, asset provenance, timing range, scene count, review checklist, revision
  guidance, and still-blocked actions. Do not turn it into render execution.
- Harden local TTS with continued Piper voice-quality QA. Keep models and generated audio ignored;
  the current implemented foundation is deterministic reference WAV, operator audio review Markdown,
  optional configured `local-piper` shell-out, pinned Turkish model setup into ignored `models/`,
  provider model/config digest provenance, local smoke evidence, and `producer doctor`
  setup/remediation next actions. Evidence/readiness/status now mark deterministic-local WAVs as
  timing/reference only, and next-action guidance limits render approval with that audio to local
  timing drafts. `producer review voice` now prints the validated local audio review handoff before
  render approval, including the exact approval command and explicit `timing-draft-only` versus
  `production-voice-candidate` scope. Studio production-media rows surface the same review command,
  render approval command, and scope read-only. Keep the listen-before-render decision boundary
  explicit.
- Harden FFmpeg draft render visual polish; the current foundation is exact-approval-gated local MP4
  with intro/outro source-card bookends or source-frame sequences, scene-timed background plates,
  subtitle burn-in, lower-third, popup-card, waveform, watermark overlays, render manifest evidence,
  source-frame cadence, render approval ID/reference plus voiceover mode/quality/candidate
  classification preserved from approval through evidence, fail-closed `ffprobe` media validation,
  stable read-only FFmpeg review command evidence, and an operator-readable
  `production/render/draft_review.md` checklist plus manifest-bound
  `production/render/youtube_chapters.*` upload-prep drafts and render/review CLI handoffs with
  exact local `producer decide render` command templates, read-only
  `producer review render-decision` evidence readback, local-only decision guidance surfaced through
  CLI status, evidence Markdown, and read-only Studio panels, plus `producer review-bundle` as the
  local final handoff index tying
  script/package/render-plan/voiceover/draft-render/evidence/readiness/decision artifacts together
  without approving upload or publish. `producer channel-handoff` then prepares a manual-only local
  channel checklist from an accepted final review bundle, binding the MP4, subtitles, metadata,
  chapter draft, thumbnail candidates, and final-review digest. `producer decide channel-handoff`
  records the selected thumbnail/manual channel-prep decision, and status/operator desk/Studio
  surface the durable local decision without calling YouTube APIs or granting upload/publish
  approval. Manifest v8 now keeps bookends outside voiceover/subtitle timing, records deterministic
  source-SRT-to-audio scaling, scopes overlays to scenes, masks sample popup copy before drawing
  wrapped runtime text, validates probe/manifest duration agreement, and supports rejected-draft
  archival/reapproval. Remaining work is complete-episode pronunciation/sync review, broader visual
  variety, editable/licensed overlay sources, and minimum-publishable-draft criteria.
- Use `producer eval local-model` before more Qwen-specific tuning. Compare configured local
  candidates through the same idea/script gates, receipt evidence, JSON compliance, repetition
  checks, Turkish label discipline, and operator quality review. Prefer eval-only CLI overrides for
  one-off bake-offs and `producer eval local-model-candidates` for same-runtime candidate
  comparisons so the project config does not churn between local model tests. Candidate comparison
  reports should keep using repeatable temperature-0 requests and surfacing deterministic
  recommendations and next operator commands without editing config. `--include-local-gguf` should
  keep discovering ignored `models/llm/*.gguf` candidates without requiring config edits. Mixed
  comparisons that find at least one passing candidate should remain successful operator evidence;
  comparisons with no passing candidate should still fail and ask for more candidates. In
  `llama.cpp` mode, keep `/v1/models` preflight and served-model mismatch checks fail-closed so one
  loaded GGUF cannot masquerade as another candidate. `llama.cpp` support is the local
  OpenAI-compatible runtime path for this work; live model runs remain manual/local and outside CI.
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
- Keep the Studio home doctor summary and `/doctor` route aligned with persisted `producer doctor`
  JSON/Markdown artifacts, including malformed or missing diagnostics states and safe remediation
  commands. The explicit guarded doctor action may run the canonical workflow-read-only CLI
  diagnostic refresh, which writes ignored diagnostics but must not edit config, start providers,
  download models, or mutate workflow state.
- Keep the read-only Studio home latest-run readiness summary aligned with `listStudioRuns()` and
  persisted readiness/evidence artifacts. It must not duplicate workflow state or trigger CLI work.
- Keep the read-only Studio home manual analytics summary aligned with
  `getStudioAnalyticsOverview()` and local analytics artifacts. It must not call YouTube APIs or
  infer causality from incomplete imports.
- Keep Studio read-only artifact previews useful as new artifact types are added. Current previews
  include operator-phase grouping, media-specific metadata, and per-artifact review wording while
  keeping the surface non-mutating.
- Keep Studio prompt inventory and `/prompts` route aligned with prompt defaults and local override
  safety while evolving it through the approved guarded editor contract. Editing, diff review,
  attributed save, and rollback must call CLI/core; the page must never call providers, rewrite
  active runs, or infer approval from a saved prompt.
- Keep Studio local model evaluation summaries aligned with ignored `diagnostics/local_model_eval.*`
  and `diagnostics/local_model_candidates_eval.*` artifacts. Explicit guarded evaluation actions may
  call the canonical local CLI evaluation, but must not edit provider config, start/download models,
  generate production runs, call hosted providers, or weaken fail-closed parser checks.
- Keep optional Studio observability best-effort and privacy-minimal. Sentry must remain disabled
  without DSN configuration, exclude mutation payloads and artifact contents, and never affect
  route authorization, workflow outcomes, approvals, evidence, or retries.
- Keep Studio evidence panels conservative: missing, malformed, or stale evidence must point back to
  `producer evidence --run <run_id>` and must not imply blocked actions are absent or media is
  review-proof.
- Keep CLI status evidence panels equally conservative: production media rows may fall back to
  artifact records for visibility, but the text must say they are not current evidence proof and
  reuse the shared production-media review guidance.
- Keep the Studio mutation-service status panel aligned with route-security and service contract
  changes; it may show guarded local approval/review/workflow-stage routes, but upload/publish
  actions must remain disabled. Keep the Studio action workbench aligned with the same contracts so
  operators can see whether the current run has a guarded web action, a CLI-only next action, or no
  safe action without implying upload, publish, paid-provider execution, or frontend-owned workflow
  state.
- Harden manual analytics feedback with import edge cases and richer comparisons while keeping data
  operator-provided and local-only. Guarded Studio import/report routes now call the local CLI
  without YouTube APIs, upload, publish, or run workflow mutation. Run-linked summaries,
  unmapped-record visibility, non-causal repeat / avoid-without-revision / mixed-signal inspect /
  test-next prompts, simple confidence/missingness framing, a fillable run-link CSV template for
  missing `run_id` values, and the shared CLI/Studio import data-quality summary plus read-only
  Studio analytics overview with report freshness summaries are implemented.
- Maintain typed Studio mutation service contracts that both CLI and web can use before adding
  additional Studio mutations. Current contracts cover guarded idea/script/cost/render approvals,
  guarded idea-run and workflow-stage/review actions, bounded script/package-artifact revision
  actions, guarded manual analytics actions, the guarded local render-decision and channel-handoff
  decision evidence writes, plus disabled upload/publish actions.
- Keep local prompt overrides safe while adding the approved prompt editor. Tracked
  `prompts/defaults/` runtime defaults, typed keys, source paths, and prompt hashes are implemented;
  ignored `prompts/local/*.md` revisions must remain provenance-recorded, local-only, bounded to the
  prompt root, and fail-closed outside it.
- Keep package artifact revision events safe. `producer revise package-artifact` now supports
  bounded edits to subtitles, scenes, popup-card package Markdown, and YouTube metadata only while
  the run is still `PRODUCTION_PACKAGE_GENERATED`; it snapshots before/after content, refreshes the
  production-package manifest, invalidates stale evidence/readiness/render-plan artifacts, and
  records revision evidence. Future work can extend this to richer editor UX and per-field diffs
  without weakening the cost/render approval boundary.
- Maintain route security requirements before any additional web action routes exist; current tests
  cover read-only page routes, guarded local approval/review/workflow-stage routes, bounded revision
  routes, manual analytics routes, disabled upload/publish action routes, and bind each action route
  to a shared service contract.
- Keep the internal reserved-provider execution contract ready for a separately approved real
  adapter without adding paid SDKs, credentials, or operator execution commands.

## Later

- Repeat live local-model QA only after provider, prompt, model-setting, or evaluation-harness
  changes justify the time cost.
- YouTube Analytics API only after manual analytics import/reporting proves useful.
- Public/scheduled publish only after separate risk review.

## Do Not Do Yet

- Do not implement additional Studio mutations before shared service contracts, route security
  requirements, and negative tests exist.
- Do not add paid providers outside the approved ElevenLabs and single hosted-still slices, or make
  live paid calls without the exact approval/budget/evidence boundary.
- Do not add paid/generative media providers before deterministic local planning, TTS, and render
  flows are useful.
- Do not implement private upload before exact local media review and upload-approval contracts are
  reliable. Do not implement public or scheduled publishing for v1.
- Do not create a second state machine in frontend code.
- Do not infer approvals from files or readiness output.
