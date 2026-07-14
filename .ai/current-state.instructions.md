# Current State

## Implemented

- TypeScript CLI project.
- Mock-first provider layer with Ollama and local OpenAI-compatible `llama.cpp` adapters.
- Managed `pnpm model:start` / `pnpm model:stop` commands read ignored llama.cpp config, validate the
  configured GGUF, preserve the served-model alias, bind the configured loopback endpoint, use one
  parallel slot, and keep the PID under ignored diagnostics.
- Typed runtime loading of tracked `prompts/defaults/` product prompt defaults plus explicit ignored
  `prompts/local/*.md` overrides for ideas, scripts, and production packages, with prompt
  key/source/hash provenance.
- Strict run state machine.
- Schema-validated run records with atomic JSON replacement.
- Zod 4-native runtime schemas with strict persisted objects, ISO timestamp validation, current
  top-level format validators, and a regression test rejecting deprecated or legacy Zod 3 APIs.
- Canonical bounded run-ID validation before state, ledger, artifact, or cost path construction;
  persisted run IDs must match their containing directory.
- Canonical bounded artifact-relative path validation before run artifact reads, writes, ledger
  events, or state persistence.
- Canonical existing-component symlink containment for the `runs/` root, run directories, internal
  directories, state, ledgers, reservation lock, and artifacts before filesystem access.
- Final regular files with multiple hard links are rejected before reads, writes, or append-only
  ledger mutation.
- Atomic temporary-file replacement for JSON and text artifact writes.
- Approval ledger.
- Content-addressed script review and approval; non-blocking review warnings require explicit
  acknowledgement before script approval, and packaging rejects changed script content.
- Attributable script revisions with before/after snapshots, stale review/approval invalidation, and
  evidence-bundle visibility.
- Cost ledger and budget guard, including provider-call preflight for ideas, scripts, and production
  packages using stage pricing estimates.
- Versioned future paid-generation cost quote bundles bound to the production package, relevant
  config, enabled stage pricing, budgets, and exact JSON-plus-Markdown digest; approval is explicit
  and content-addressed.
- Versioned production-package manifests bind the approved script and prompt/provider provenance to
  exact voiceover, subtitle, scene, YouTube metadata, and package-Markdown digests.
- Project-wide atomic cost reservations with one-time approved quote-line consumption, operation-id
  idempotency, active-reservation hard-budget accounting, integer USD micros, recoverable
  settlement, uncertain outcomes, and explicit reconciliation.
- Internal adapter-bound reserved-provider execution with a durable `EXECUTION_STARTED` claim,
  provider/model quote matching, local at-most-once callback dispatch, bounded timeout/abort,
  fail-closed unknown outcomes, exact settlement, and hashed request-id evidence.
- Script content review heuristics, including clickbait title warnings, long-form shortfall
  warnings, and blockers for incomplete or English-labeled provider output.
- Script review Markdown shows the next safe approval command or blocker remediation guidance.
- Brand, overlay, intro, and outro asset inventory checks.
- Production package generation with complete manifest creation after all derived artifacts are
  persisted.
- Production package voiceover/subtitle artifacts are derived from exact `Anlatıcı:` lines only.
  Exact `Görsel:` directions are preserved as scene visual prompts for render planning, not spoken
  by TTS or burned into subtitles. Subtitle SRT output is split into wrapped timed cues for local
  draft-review readability.
- Render Plan + Contact Sheet MVP consumes the verified production-package manifest and tracked
  assets, then writes `production/render_plan.json`, `production/storyboard_contact_sheet.md`, and
  `production/asset_provenance.json` without FFmpeg render, upload, paid provider, or public publish
  execution. Intro/outro source frames are recorded when present. The contact sheet includes timing,
  visual rhythm review, scene-to-asset mapping, intro/outro source-frame paths, background reuse,
  popup-card copy, asset role counts, review gates, safe commands, revision path, and upload/publish
  blockers. `producer review render-plan` gives operators a read-only handoff from validated
  render-plan evidence and surfaces the contact sheet, asset provenance, scene count, asset count,
  timing range, bookend/frame sources, visual rhythm checklist, revision guidance, and still-blocked
  actions.
- Evidence and readiness now surface render-plan presence; missing render plans warn, while partial
  or malformed render-plan artifacts block readiness.
- Disabled-by-default local voiceover generation. `producer voice` requires local TTS config,
  `READY_FOR_MANUAL_PRODUCTION`, explicit script approval, a verified production package, and valid
  render-plan evidence before it writes `production/audio/voiceover.wav` and
  `production/audio/voiceover.meta.json`, and `production/audio/voiceover_review.md`.
  `deterministic-local` is a timing/reference adapter; `local-piper` shells out to a configured
  local Piper binary and ignored model path. Local Piper metadata, evidence, and review Markdown now
  record the model/config SHA-256 digests used for the generated WAV. Piper PCM16 output is
  deterministically peak-normalized to -1 dBFS before hashing/persistence and records source peak,
  target peak, and applied gain. The review Markdown includes
  an explicit listen-before-render decision boundary, render-approval scope, and exact next safe
  commands. Evidence, readiness, status, and blocked-action summaries mark deterministic-local WAVs
  as timing/reference only until reviewed local Piper audio exists. Next-action guidance explicitly
  says render approval with deterministic-local audio is only for a local timing draft.
  `producer review voice` gives operators a read-only handoff from validated voiceover evidence
  before render approval, including the exact approval command and whether the scope is
  `timing-draft-only` or `production-voice-candidate`, while Studio production-media rows surface
  the same review command, render approval command, and approval scope without adding a web
  mutation.
- ElevenLabs v3 catalog, bounded preview, attributable selection/reselection, exact quote and
  reservation binding, synthesis adapter, original/normalized character-alignment persistence,
  settlement, redacted diagnostics, and fail-closed recovery are implemented and documented in
  [the focused current-state note](current-state/elevenlabs-voice.instructions.md). Automated paid
  execution remains mocked: no live production synthesis has been validated. Free-tier
  metadata/catalog/preview access does not establish commercial production rights and must never
  bypass exact eligibility, quote, persisted approval, reservation, or settlement gates.
- `pnpm tts:piper:setup` downloads the pinned CPU-friendly Turkish
  `speaches-ai/piper-tr_TR-fahrettin-medium` model into ignored `models/` and prints the matching
  local config override for `local-piper`.
- `producer doctor` diagnostics persist next-action fields in JSON and Markdown for prompt override
  path/content problems, disabled TTS, deterministic reference audio, valid local Piper config, and
  local Piper remediation.
- Approval-gated local FFmpeg draft render. Exact render-plan, canonical voice evidence, active
  subtitle descriptor/timing mode, and voice classification approval are required before writing
  the MP4, schema-v9 manifest, review, and manifest-bound chapter artifacts. The concat timeline uses
  bookends, scenes, and available source frames; audio/subtitles stay outside bookends, SRT timing
  maps to actual voice duration, and
  lower-third/waveform/popup overlays stay scene-scoped. Sample popup copy is masked before plain
  wrapped runtime text is drawn. The manifest records timing, cadence, overlay placement, approval,
  execution/review commands, and `ffprobe` evidence. CLI, evidence, and Studio expose local review
  and durable decision guidance only when current render evidence passes; upload and public or
  scheduled publish remain disabled.
- `producer revise render` closes the fail-closed recovery loop after `needs-revision` or `rejected`:
  it archives the current MP4, manifest, decision, evidence, and readiness under
  `revisions/render/<revision_id>/`, invalidates the stale render approval, transitions back to
  `READY_FOR_MANUAL_PRODUCTION`, and requires a fresh exact approval. If current render evidence is
  unreadable after a contract upgrade, explicit reason/reviewer attribution plus the persisted MP4
  hash and active approval binding are required before the same archival recovery is allowed.
- Provider-backed idea and production-package stages schema-validate and normalize common local
  model JSON variants before artifact writes, while rejecting malformed or English operator-facing
  payloads fail-closed.
- Ollama provider config supports `thinkingMode` (`default`, `think`, `no_think`) and stage-specific
  `maxOutputTokens` caps that are passed to Ollama as `num_predict`.
- `llama.cpp` provider config supports a local OpenAI-compatible `llama-server` base URL,
  `/v1/models` doctor diagnostics, `/v1/chat/completions` generation, bounded request timeouts, and
  JSON/JSON schema response-format forwarding without hosted API credentials.
- Local-model evaluation runs deterministic idea/script parser-contract checks and writes ignored
  JSON/Markdown reports with hashes, duration/token metadata, one-run overrides, and no raw provider
  output. Candidate comparison can discover ignored GGUF files, recommends only candidates passing
  all checks, treats a passing mixed result as useful evidence, and exits non-zero when none pass.
  `llama.cpp` candidates must be actively served and provider-reported model identity must match;
  config is never mutated. Studio can refresh and read these reports without starting servers,
  downloading models, calling hosted APIs, or weakening parser gates.
- Studio reads ignored local model evaluation JSON/Markdown artifacts on home and `/eval`, including
  missing, malformed, schema-invalid, passing, and blocked reports. A guarded action refreshes the
  canonical CLI evaluation without editing providers, starting servers, downloading models, calling hosted APIs, or weakening parser gates.
- Script generation uses bounded section calls and continuation passes, carries accepted expansion
  context forward, and writes `script.sections.json` receipts before assembling `script.md`. Up to
  three continuations target at least 1,100 spoken narration words for an 8-12 minute draft;
  directions do not count. Prompt provenance, token/cost totals, retries, and blockers include every
  pass. Remaining shortfall fails closed before final script artifacts and persists only safe
  diagnostics.
- Script continuation parsing remains JSON-first but accepts bounded raw Turkish continuation text
  from local models when the response has complete sentences and exact Turkish production labels.
- Script review and generation now block malformed Turkish production labels, unaccented production
  labels such as `Anlatici:`/`Gorsel:`, repeated sentence loops, model self-evaluation commentary,
  and literal escaped control text so local model drafts cannot pass solely because they reached the
  word-count floor.
- Script section parsing applies bounded production-label repair for known local-model variants such
  as `Anlatici:`, `Anlatyıcı:`, `Gorsel:`, and `Görsel -`; repaired text uses exact labels and
  `script.sections.json` receipts record count/variant evidence without storing raw provider output.
  Unrelated malformed, English, or unsafe labels still block.
- Malformed production-label blockers now include safe diagnostic categories such as label family
  and issue class, not raw provider label text. This makes live Ollama failures more actionable
  while preserving the raw-output-free diagnostics boundary.
- Repeated sentence-loop blockers now include safe diagnostic categories such as repeat count and a
  short normalized sentence fingerprint, not raw provider text. This lets live Ollama retries prove
  repeated-output failures without persisting the repeated sentence.
- Script section and continuation content blockers now get up to two bounded retries using only safe
  blocker summaries and already accepted context. Rejected raw provider text is discarded; the
  accepted `script.sections.json` receipt records retry evidence with prompt/content hashes, token
  estimates, and duration for each rejected attempt.
- Successful script generation removes stale `diagnostics/script_generation_failure.json` evidence
  from both disk and the run artifact list, with a ledger event, so an earlier failed retry cannot
  make a later successful run look blocked.
- Live qwen3:8b QA proved the fail-closed guards and retry evidence work, but also showed repeated
  ideas, malformed Turkish production labels, short scripts, and weak/repetitive drafts. Qwen/Ollama
  remains useful regression evidence, not the production-quality default. The next model work is a
  controlled local evaluation path across GGUF candidates, using `llama.cpp` where useful, before
  more Qwen-specific prompt tuning.
- Script continuation parsing accepts additional bounded malformed local-model `"text"` wrappers,
  including trailing commas, missing closing quotes, and short external notes, only after the
  extracted Turkish continuation still passes complete-sentence and exact-label validation.
- Continuation request JSON schema no longer carries a large `maxLength` repetition bound because
  live Ollama qwen3 still rejected `char{1,2400}` grammar with a sane-defaults warning. The
  parser-side 2400-character guard remains authoritative for accepted continuation text.
- Script expansion prompts now explicitly warn against repeated sentence skeletons, metaphors, and
  visual directions across the draft and already-written chunks.
- Script provider parse/transport failures and content-blocker failures persist safe run diagnostics
  without advancing state or storing raw provider output. Section content blockers include the
  section id, pass, and expansion chunk when available. `producer status` and Studio run detail
  surface these safe diagnostic summaries so operators can see the blocker without opening JSON
  artifacts by hand.
- Historical live Ollama/qwen3 runs on 2026-06-23 through 2026-06-25 verified doctor, idea
  generation, explicit idea approval, sectioned script generation, continuation receipts, safe
  diagnostics, and no upload/render/publish side effects. They also repeatedly exposed below-target
  quality: duplicate ideas, generic title motifs, repeated premise frames, malformed labels, English
  leftovers, repeated sentence loops, unsupported science framing, and underfilled scripts.
- Idea generation now retries up to two bounded repair attempts with parser validation feedback when
  a local-provider response fails `Invalid ideas provider response` validation. Repair attempts
  write no raw rejected output, record ledger warnings, include `ideas.json.repair` metadata on
  success, aggregate token/duration evidence across attempts, and still fail closed without idea
  artifacts if the final repair response is invalid.
- Idea generation provider validation and transport failures persist safe run diagnostics without
  advancing state or storing raw provider output. `producer status` and Studio run detail surface
  these summaries so operators can see why a `NEW` run did not produce reviewable ideas.
- Idea parsing now also rejects repeated sentence loops inside idea fields, malformed `Uykul...`
  brand fragments, English scientific lane terms such as `exoplanet`, and repeated generic `fit`
  explanations across a slate. Planner and repair prompts now ask for Turkish lane terms and
  slot-specific `fit` explanations.
- Idea parsing now rejects repeated local-model boilerplate in `fit` explanations, repeated
  uncertainty openers such as `Belki bu`, generic unknown-species/trace phrases, and weak premise
  action frames such as `bilgiyi bulduktan sonra` or `anlamaya çalışır`.
- Idea generation now reads compact title-only history from existing runtime `ideas.json` artifacts.
  Previously generated or approved titles are fed back into the planner prompt as originality
  context and are hard-blocked if a provider repeats the same normalized title in a later run. This
  uses runtime artifacts only; `.ai/` remains development-only and no vector database is required
  for the v1 guard.
- Live qwen3 retry/repair tests proved runs stay in safe states without writing review artifacts
  when idea or script validation fails, while safe diagnostics and ledger warnings still identify
  the blocker category and stage boundary.
- Script section prompts now include an exact-label checklist that permits only `Anlatıcı:` and
  `Görsel:` with Turkish accents.
- Prompt-only label discipline was not enough for qwen3. Bounded label repair now has receipt
  evidence for known variants, but production quality remains a model/evaluation problem rather than
  a reason to loosen blockers.
- Evidence bundle generation with production-package integrity status and manifest digest.
- Evidence next-command guidance reflects script review blockers and required warning
  acknowledgement before script approval. Evidence JSON keeps portable command templates; evidence
  Markdown renders the current run id plus shared conservative production-media `Review:` guidance
  without treating missing, stale, or malformed media evidence as current proof.
- `producer status` now defaults to an operator summary with state, counts, approval ledger,
  warnings, evidence/readiness availability, attention checks, blocked-action details, production
  media evidence, recent artifacts, and current-run next action. Early states still show the
  actionable stage command before evidence exists. Invalid or stale evidence points back to
  `producer evidence --run <run_id>` and labels production media as artifact-record fallback.
  Production media rows use the same shared review-action helper as evidence Markdown and Studio.
  Missing, malformed, or stale readiness diagnostics point back to
  `producer readiness --run <run_id>`. `--json` preserves raw persisted state output;
  `--summary-json` prints the enriched operator status snapshot.
- `producer desk` provides an Ink-based local terminal workbench over the same
  status/readiness/media contracts, with `--plain` for scriptable or non-TTY output. It opens by
  default when `producer` is run without a subcommand, shows readiness attention, blocked actions,
  safe run diagnostics, copyable operator commands, production media review commands, recent
  artifacts, render decisions, and a read-only v1 workflow progress projection. It is an operator
  surface only and does not own workflow transitions or mutate run state.
- `producer decide render` records the human draft-render decision as durable `production/render/`
  evidence, keeps the run in `RENDERED`, and never approves upload or publish.
- `producer review-bundle` writes `production/review_bundle.*` after current draft-render evidence.
  It revalidates render-plan, voiceover, draft-render, and render-decision status; missing decisions
  are `decision-pending`, while stale/invalid evidence blocks. The bundle points to the timestamped
  review map and remains a local operator index only.
- `producer channel-handoff` writes accepted-review `production/channel_handoff.*` and
  `production/thumbnail_candidates.*` with copy-ready, digest-bound manual prep fields.
- `producer decide channel-handoff` writes durable `production/channel_handoff_decision.*` evidence
  for selected-thumbnail/manual prep surfaced without YouTube APIs or upload/publish approval.
- Studio run detail shows guarded approval, workflow-stage/review/revision, render-decision, and
  channel-handoff decision routes over CLI/core evidence contracts. Home can start ideas, and
  home/queue can run no-extra-input workflow-stage actions only when CLI/core recommends them.
  A non-accepted draft's canonical `revise render` next command maps to a guarded Studio route;
  explicitly attributed invalid-evidence recovery remains CLI-only. Guarded action panels show
  compact producer record summaries after completion. Upload/publish stay disabled.
- Readiness diagnostics that strictly parse and revalidate persisted cost quotes, live hard budgets,
  complete production-package integrity, and exact paid-generation cost approval when required.
- Blocked and warning `producer readiness` checks print and persist next-action guidance for common
  operator steps such as render-plan generation, cost estimation, local voiceover generation, render
  approval, local draft render, exact quote approval, and evidence refresh.
- Disabled upload and publish placeholders.
- Optional `pnpm qa:product` smoke covers happy path, tamper/order abuse, disabled upload/publish,
  analytics recovery, render decisions, and Studio visibility.
- Production build emits a Node-runnable `dist/cli.js` and `pnpm build:smoke` verifies the built CLI
  starts and can initialize a fresh project from an arbitrary working directory.
- `producer doctor` project diagnostics with durable local JSON/Markdown evidence for config,
  provider/model availability, local TTS/Piper readiness with next actions, local FFmpeg/ffprobe
  toolchain availability, assets, and publish defaults.
- Blocked `producer doctor` provider and publish-default diagnostics include operator-facing
  `nextAction` remediation guidance in terminal, JSON, and Markdown output; risky
  upload/private/public publish config still blocks.
- Project-local capability routing, resumable `.ai/checkpoints/`, dependency auditing, and the
  conventional-commit release workflow are documented and covered by repository quality gates.
- Studio uses the existing Tailwind/shadcn/Radix design system and a typed `next-intl` foundation;
  full operator-copy translation remains future work.
- Studio can list local persisted runs with counts, readiness/evidence status, remediation, and
  next-action visibility, then refine the operator queue with read-only shadcn sort, search, filter,
  blocker-limit, density, and tuning controls. Studio run detail shows a persistent action rail over
  next safe action, blockers, mutation session, guarded local approvals/review decisions, readiness
  checks, generated idea approval choices, a compact run-review brief, warnings, approvals, ledger
  entries, blockers, production media evidence, shared review guidance, shared v1 workflow progress,
  and review artifacts. Missing/stale readiness points to `producer readiness --run <run_id>`;
  malformed or stale evidence points to `producer evidence --run <run_id>` and is not proof for
  blockers, production-media readiness, or next actions. Studio labels media rows as persisted
  artifact-record fallback until evidence is current, streams only allowlisted local
  voiceover/draft-render artifacts for browser playback, does not mutate run state or call
  providers, and reuses the CLI/core next-action contract in early states.
- Studio run detail includes read-only artifact preview excerpts for scripts, reviews, production
  packages, render plans, contact sheets, asset provenance, evidence, readiness, voiceover metadata,
  and render manifests. Previews are grouped by operator review phase with per-artifact review
  guidance, and binary media is intentionally limited to metadata.
- Studio has a read-only `/assets` visual inventory page backed by configured asset guard
  directories and committed render-support asset categories. It surfaces invalid producer config and
  missing guarded assets as operator warnings without approving assets, rendering media, or mutating
  run state.
- Studio home and `/doctor` surface read-only producer diagnostics backed by ignored
  `diagnostics/doctor.json` and `diagnostics/doctor.md`. Studio home also surfaces latest-run
  readiness/evidence status from existing run summaries. These views surface persisted
  config/provider/TTS/asset/publish checks, summary counts, Markdown preview, malformed or missing
  diagnostic states, readiness state, and the next safe remediation. They do not run doctor, edit
  config, start providers, download models, upload, publish, or mutate workflow state.
- Studio home and `/prompts` have read-only runtime prompt inventory visibility for tracked
  `prompts/defaults/` sources and configured ignored `prompts/local/*.md` overrides, including
  source paths, hashes, warnings, and doctor remediation. They do not edit prompts, call providers,
  approve prompt changes, or read `.ai/` as runtime state.
- Studio home and `/analytics` surface ignored local analytics artifacts. `/analytics` can import
  operator-provided CSV/JSON text and refresh the local report through guarded CLI-backed routes
  without YouTube APIs, upload, publish, or run workflow mutation.
- Studio has a typed route-security contract for current read-only pages, the local session route,
  guarded local idea/script/cost/render approval routes, guarded idea-run and workflow-stage/review/
  revision routes, guarded manual analytics import/report routes, guarded local render-decision and
  channel-handoff-decision routes, and disabled upload/publish action routes. Tests assert that
  current App Router pages are covered, enabled local mutations require POST-only same-origin JSON,
  action headers, service-contract handling, local session proof, and cached-session cleanup after
  401; disabled upload/publish actions require CLI/core contracts, durable evidence, explicit
  approvals, and disabled publish risk.
- Shared Studio mutation service contracts exist for guarded idea/script/cost/render approvals,
  idea-run and workflow-stage/review/revision actions, local render/channel-handoff decisions,
  manual analytics actions, and disabled upload/publish actions. Contracts validate payloads, bind
  actions to CLI/core modules/exports, and require CSRF, durable evidence, and explicit approval.
- Studio actions/home render mutation-service and workflow-matrix panels showing guarded local
  approval/review routes, CLI-ready contracts, route-security findings, and disabled upload/publish
  boundaries without exposing upload/publish web mutations.
- Manual analytics feedback foundation. `producer analytics import --file <path>` accepts
  operator-provided CSV/JSON performance exports and writes ignored local
  `analytics/performance.json`, `analytics/performance_report.md`, and a fillable
  `analytics/run_link_template.csv` for videos that still need a `run_id`. Reports now include
  overall metrics, top videos, run-linked summaries, an unmapped-record table, the run-link template
  path, and non-causal repeat / avoid-without-revision / mixed-signal inspect / test-next operator
  planning prompts with simple confidence/missingness framing. CLI reports and Studio share the same
  import data-quality summary for confidence counts plus missing run links, views, impressions, CTR,
  and retention fields. Studio has a read-only `/analytics` overview over those ignored local
  artifacts and displays the run-link template path. No YouTube API, workflow mutation, upload,
  publish, or causal claim is introduced. `producer analytics report` refreshes the ignored Markdown
  report and CSV template; Studio marks report previews as missing, stale, or current by dataset
  timestamp and source digest.
- Roadmap and `.ai` guidance prioritize Production Loop Validation: repeat real local episodes,
  reduce operator/media friction, keep Studio on guarded CLI/core contracts, and use manual analytics
  before optional YouTube integrations. Prompt editing and richer production revisions remain later.
- CodeRabbit is configured to auto-suggest and auto-assign `ogiboy` for PR review.
- Local SonarQube configuration targets project `uykuluk-scifi`; manual SonarCloud scans target
  `ogiboy_uykuluk-scifi`.
- `pnpm sonar` has successfully uploaded at least one local analysis to
  `http://localhost:9000/dashboard?id=uykuluk-scifi`.

## v0.82 Voice Completion And Studio Parity Candidate

- The active branch implements aligned Turkish SRT plus metadata from ElevenLabs original character
  timing and binds the verified subtitle descriptor through voice evidence, render approval, render
  manifest, FFmpeg, and Studio caption consumers. Incomplete ElevenLabs evidence does not silently
  fall back to linear timing.
- The same slice adds guarded Studio candidate, preview, select, reselect, and exact hosted
  production-confirmation actions over the existing CLI/core owners. Provider URLs and secrets stay
  server-side. Focused integration tests, two consecutive local full suites, a CI-shaped suite,
  product/browser QA, and real production-build Studio UAT pass; remaining work is PR-ready coverage,
  dependency, version, and Sonar validation plus review/merge.
- Deterministic-local and Piper remain credential-free fallbacks. They retain explicit
  `linear-fallback` subtitle timing; deterministic-local is reference timing only, while Piper still
  requires operator listening before production use.
- After this slice, delivery order is scene-specific visuals plus exact render, script audition plus
  editorial provenance, resumable private-only YouTube upload, then persistent settings/prompts,
  onboarding, documentation productization, and real-episode acceptance.
- Private-only upload is required for v1 controlled distribution. It is not implemented yet. Public
  and scheduled publishing remain unavailable and out of v1 scope.

## Current Commands

```bash
pnpm producer init
pnpm producer doctor
pnpm producer doctor --json
pnpm producer ideas [--json]
pnpm producer approve idea --run <run_id> --idea <idea_id> [--json]
pnpm producer script --run <run_id> [--json]
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name> [--json]
pnpm producer review script --run <run_id> [--json]
pnpm producer approve script --run <run_id> [--json]
pnpm producer approve script --run <run_id> --acknowledge-warnings [--json] # when review warnings remain
pnpm producer package --run <run_id> [--json]
pnpm producer revise package-artifact --run <run_id> --artifact subtitles --file <path> --reason "<reason>" --editor <name> [--json]
pnpm producer render-plan --run <run_id> [--json]
pnpm producer review render-plan --run <run_id> [--json]
pnpm producer estimate --run <run_id> [--json]
pnpm producer approve cost --run <run_id> [--json]
pnpm producer evidence --run <run_id> [--json]
pnpm producer readiness --run <run_id> [--json]
pnpm producer status --run <run_id>
pnpm producer status --run <run_id> --json
pnpm producer status --latest
pnpm producer desk
pnpm producer desk --run <run_id>
pnpm producer desk --plain
pnpm producer list-runs
pnpm producer list-runs --json
pnpm producer voice --run <run_id> [--json]
pnpm producer review voice --run <run_id> [--json]
pnpm producer approve render --run <run_id> [--json]
pnpm producer render --run <run_id> [--json]
pnpm producer decide render --run <run_id> --decision accepted-for-local-review --notes "<operator notes>" --reviewed-by operator [--json]
pnpm producer decide render --run <run_id> --decision needs-revision --notes "<operator notes>" --reviewed-by operator [--json]
pnpm producer decide render --run <run_id> --decision rejected --notes "<operator notes>" --reviewed-by operator [--json]
pnpm producer revise render --run <run_id> [--json]
pnpm producer revise render --run <run_id> --reason "<reason>" --reviewed-by operator [--json] # invalid-evidence recovery only
pnpm producer review render-decision --run <run_id> [--json]
pnpm producer review-bundle --run <run_id> [--json]
pnpm producer channel-handoff --run <run_id> [--json]
pnpm producer decide channel-handoff --run <run_id> --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes "<operator notes>" --reviewed-by operator [--json]
pnpm model:start
pnpm model:stop
pnpm producer analytics import --file <path> [--json]
pnpm producer analytics report [--json]
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
pnpm studio
pnpm qa:browser
pnpm release:check
pnpm version:plan
```

## Validation

Use:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm qa:usage
pnpm qa:browser
```

If the shell does not expose `node` or `pnpm`, use the Codex bundled Node path or restore
Corepack/PATH before treating failures as product failures.

## Known Limits

- Ollama and `llama.cpp` doctor checks verify local server reachability and configured model
  inventory, but live local-model QA is environment-dependent and not part of CI. Historical qwen3
  runs proved the safety architecture but not production-quality output. A live Gemma 3 12B GGUF
  run completed the full idea-to-manual-handoff loop after bounded script continuation and
  attributable operator revisions; that is useful workstation evidence, not proof that every draft
  is production-ready or that operator review can be removed. Qwen stays a regression target while
  candidates continue through the same approval, JSON, repetition, Turkish-label, spoken-word, and
  operator-quality gates.
- Ollama and `llama.cpp` configuration accepts only credential-free loopback HTTP(S) origins, preventing local adapters from silently becoming arbitrary outbound endpoints; hosted or LAN provider support needs a separately reviewed adapter boundary.
- ElevenLabs is the only approved hosted production provider currently implemented. It remains
  disabled without explicit config, server-only credentials, exact quote approval, reservation,
  commercial production rights, and operator-triggered synthesis; no live paid call has run. A free
  account may support permitted audition metadata/previews but cannot prove production eligibility.
  No hosted visual provider or private-upload adapter is enabled; public/scheduled publish remains
  out of scope.
- Current local-first Studio combines read/review pages and grouped artifact metadata with guarded mutations backed by canonical CLI/core contracts. Stage and Studio-lib roots retain stable public entrypoints while domain helpers live in named subfolders. Route security covers page reads, short-lived session proof, same-origin actions, and disabled upload/publish; generation and local render run only through guarded contracts.
- Studio voice review now exposes guarded catalog refresh, persisted local previews, A/B comparison,
  attributable selection/reselection, quote/quota state, and exact hosted execution confirmation;
  CLI/core remains authoritative for every state, approval, cost, and provider transition.
- Optional Sentry captures unexpected Next.js and Studio mutation-boundary failures without request
  bodies/artifacts; without a DSN it is disabled and never affects workflow or authorization.
- Local prompt overrides are ignored `prompts/local/*.md` paths configured in
  `producer.config.json` and recorded in provenance. Prompt editing/revision UI remains future work;
  tracked defaults stay read-only. Full translation catalogs and a language selector are deferred.
- Approved settings/prompt editing is not implemented. Saves affect the next command; in-flight
  work stays pinned; listener/build-time settings restart; secrets stay env-only.
- Initial package artifact revision contracts cover subtitles, scenes, popup-card package Markdown,
  and YouTube metadata. They are limited to `PRODUCTION_PACKAGE_GENERATED`, refresh the manifest,
  and invalidate stale evidence/readiness/render-plan artifacts; richer per-field editing UX and
  post-estimate repair flows remain future work.
- Render planning does not render media, approve render execution, or reserve spend. It is a local
  review/planning artifact only.
- Local TTS provides deterministic/reference WAV, Piper shell-out, ignored-model setup, digest
  provenance, and review Markdown. It does not commit voice models, approve render execution,
  upload, or publish. Deterministic-local evidence is timing proof only; production voice quality
  still requires operator listening.
- FFmpeg draft render creates a local review MP4 from intro/outro sources, scene-timed plates,
  audio-bound subtitles, overlays, voiceover, evidence, a read-only review command, and checklist.
  Rejected drafts archive safely; reusable clips, exact TTS alignment, and polish remain follow-up.
- Private upload remains disabled placeholder behavior but is a v1 controlled-distribution
  deliverable. Public/scheduled publish remains unavailable and out of scope; manual/Studio
  analytics are local-only and richer APIs are not implemented.
- Run-path containment blocks pre-existing symlinks; hostile concurrent replacement remains a local
  TOCTOU limitation because portable Node APIs lack directory-handle `openat` semantics.
- Brand, overlay, thumbnail, background, transition, icon, waveform, intro-frame, and outro-frame
  assets are present. The local draft renderer consumes intro/outro source frames when present.
  Editable source files, reusable rendered intro/outro clips, and font licensing notes remain useful
  additions.
- Stable git tags are present and release automation treats the latest reachable stable tag as the
  release base. Release planning fails if `package.json` drifts from that latest stable tag. Sonar
  scan upload requires `SONAR_TOKEN` or Keychain; tokens must never be tracked.
