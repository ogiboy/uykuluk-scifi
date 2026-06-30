# Current State

## Implemented

- TypeScript CLI project.
- Mock-first provider layer with Ollama and local OpenAI-compatible `llama.cpp` adapters.
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
- Render Plan + Contact Sheet MVP consumes the verified production-package manifest and tracked
  assets, then writes `production/render_plan.json`, `production/storyboard_contact_sheet.md`, and
  `production/asset_provenance.json` without FFmpeg render, upload, paid provider, or public publish
  execution. Intro/outro source frames are recorded when present. The contact sheet includes timing,
  visual rhythm review, background reuse, asset role counts, review gates, safe commands, revision
  path, and upload/publish blockers. `producer review render-plan` gives operators a read-only
  handoff from validated render-plan evidence and surfaces the contact sheet, asset provenance,
  scene count, asset count, timing range, visual rhythm checklist, revision guidance, and
  still-blocked actions.
- Evidence and readiness now surface render-plan presence; missing render plans warn, while partial
  or malformed render-plan artifacts block readiness.
- Disabled-by-default local voiceover generation. `producer voice` requires local TTS config,
  `READY_FOR_MANUAL_PRODUCTION`, explicit script approval, a verified production package, and valid
  render-plan evidence before it writes `production/audio/voiceover.wav` and
  `production/audio/voiceover.meta.json`, and `production/audio/voiceover_review.md`.
  `deterministic-local` is a timing/reference adapter; `local-piper` shells out to a configured
  local Piper binary and ignored model path. Local Piper metadata, evidence, and review Markdown now
  record the model/config SHA-256 digests used for the generated WAV. The review Markdown includes
  an explicit listen-before-render decision boundary and exact next safe commands. Evidence,
  readiness, status, and blocked-action summaries mark deterministic-local WAVs as timing/reference
  only until reviewed local Piper audio exists. Next-action guidance explicitly says render approval
  with deterministic-local audio is only for a local timing draft. `producer review voice` gives
  operators a read-only handoff from validated voiceover evidence before render approval, and Studio
  production-media rows surface the same review command without adding a web mutation.
- `pnpm tts:piper:setup` downloads the pinned CPU-friendly Turkish
  `speaches-ai/piper-tr_TR-fahrettin-medium` model into ignored `models/` and prints the matching
  local config override for `local-piper`.
- `producer doctor` diagnostics persist next-action fields in JSON and Markdown for prompt override
  path/content problems, disabled TTS, deterministic reference audio, valid local Piper config, and
  local Piper remediation.
- Approval-gated local FFmpeg draft render. `producer approve render` records approval for the exact
  current render-plan digest, voiceover digest, and voiceover mode/quality/candidate classification,
  then `producer render` requires `RENDER_APPROVED` before writing `production/render/draft.mp4`,
  `production/render/render_manifest.json`, and `production/render/draft_review.md`. The draft
  render now builds an FFmpeg concat timeline from render-plan intro/outro bookends and scenes,
  expands committed intro/outro source-frame sequences into FFmpeg inputs when enough review time
  exists, composes lower-third, popup-card, waveform, and watermark overlays when available, records
  the exact intro-to-outro timeline, source-frame counts/cadence, overlay roles/placements, render
  approval ID/reference, voiceover classification, actual temporary-output FFmpeg execution args,
  and read-only FFmpeg review command for the final draft artifact in the manifest, evidence, and
  readiness summaries, validates the output with `ffprobe` media stream evidence, and writes an
  operator-readable final local review checklist. The non-JSON CLI handoff and read-only
  `producer review render` command point to the MP4, manifest, review document, and local-only next
  action, with deterministic-reference audio labeled as a local timing draft. CLI status, evidence
  Markdown, and the read-only Studio production-media panel surface the same review command only
  when current draft-render evidence passes, and rendered runs use the read-only review command as
  their next safe action with upload/public-scheduled publish still disabled.
- Provider-backed idea and production-package stages schema-validate and normalize common local
  model JSON variants before artifact writes, while rejecting malformed or English operator-facing
  payloads fail-closed.
- Ollama provider config supports `thinkingMode` (`default`, `think`, `no_think`) and stage-specific
  `maxOutputTokens` caps that are passed to Ollama as `num_predict`.
- `llama.cpp` provider config supports a local OpenAI-compatible `llama-server` base URL,
  `/v1/models` doctor diagnostics, `/v1/chat/completions` generation, bounded request timeouts, and
  JSON/JSON schema response-format forwarding without hosted API credentials.
- `producer eval local-model` runs small local-provider idea/script parser-contract checks and
  writes ignored `diagnostics/local_model_eval.json` and Markdown reports with hashes,
  token/duration metadata, applied one-run CLI override names, and no raw provider output. Eval-only
  overrides can compare local Ollama/`llama.cpp` candidates without mutating `producer.config.json`.
  `producer eval local-model-candidates` runs the same checks for repeated `--candidate` model names
  and writes ignored `diagnostics/local_model_candidates_eval.json` and Markdown reports with a
  deterministic recommendation and next operator command only when a candidate passes all
  parser-contract checks. A 2026-06-28 qwen3:8b run stayed fail-closed on non-slot-specific idea
  `fit` explanations while its script-section sample parsed.
- Studio reads the ignored local model evaluation JSON/Markdown artifacts on the home page and
  `/eval`, distinguishing missing, malformed, schema-invalid, passing, and blocked reports without
  calling Ollama, `llama.cpp`, hosted APIs, or mutating configuration.
- Script generation uses bounded hook/context/development/outro provider calls, writes
  `script.sections.json` draft and expansion-chunk receipts, and assembles `script.md` only after
  all sections pass blocking quality checks.
- Script expansion prompts include the previous expansion chunks from the same section so local
  models have explicit context to continue from rather than repeating section-level sentence loops.
- Script generation now runs up to two bounded long-form continuation passes when the assembled
  script remains below the 1200-word review floor. Continuations extend the existing
  `Sinematik Gelişme` section, add `continuation` receipts to `script.sections.json`, and are
  included in prompt provenance, token totals, cost recording, and blocker checks.
- If both bounded continuation passes still leave the assembled provider draft below the 1200-word
  floor, script generation now fails closed before script artifacts are written and persists a safe
  diagnostic message without raw provider text.
- Script continuation parsing remains JSON-first but accepts bounded raw Turkish continuation text
  from local models when the response has complete sentences and exact Turkish production labels.
- Script review and generation now block malformed Turkish production labels, unaccented production
  labels such as `Anlatici:`/`Gorsel:`, and repeated sentence loops so local model drafts cannot
  pass solely because they reached the word-count floor.
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
  production media review commands, recent artifacts, render decisions, and a read-only v1 workflow
  progress projection. It is an operator surface only and does not own workflow transitions or
  mutate run state.
- `producer decide render` records the human decision after local draft-render review as durable
  JSON/Markdown evidence under `production/render/`. It does not approve upload or publish and keeps
  the run in `RENDERED`. `producer status`, `producer desk`, and product UAT surface the recorded
  decision so operators do not loop back to render review after a decision is recorded.
- Readiness diagnostics that strictly parse and revalidate persisted cost quotes, live hard budgets,
  complete production-package integrity, and exact paid-generation cost approval when required.
- Final readiness diagnostics agree with the post-transition run state.
- Blocked and warning `producer readiness` checks print and persist next-action guidance for common
  operator steps such as render-plan generation, cost estimation, local voiceover generation, render
  approval, local draft render, exact quote approval, and evidence refresh.
- Disabled upload and publish placeholders.
- Basic Next.js Producer Studio shell under `apps/studio` with read-only run index and run detail
  routes backed by local run/evidence/readiness service contracts.
- Visual asset pack imported under `assets/`.
- Clean-copy usage smoke script.
- Optional clean-copy product UAT smoke script via `pnpm qa:product`, covering rendered happy path,
  traversal rejection, incorrect ordering, stale evidence recovery, tampered render review command
  rejection, post-approval voiceover tamper blocking, disabled upload/publish safeguards, manual
  analytics import/report malformed-input recovery, durable local render decisions, and Studio
  read-only service visibility for runs, production media, analytics, and disabled mutation
  contracts.
- Production build emits a Node-runnable `dist/cli.js` and `pnpm build:smoke` verifies the built CLI
  starts and can initialize a fresh project from an arbitrary working directory.
- Direct mock/Ollama/llama.cpp provider diagnostics and upload/publish safeguard tests.
- `producer doctor` project diagnostics with durable local JSON/Markdown evidence for config,
  provider/model availability, local TTS/Piper readiness with next actions, local FFmpeg/ffprobe
  toolchain availability, assets, and publish defaults.
- Blocked `producer doctor` provider and publish-default diagnostics include operator-facing
  `nextAction` remediation guidance in terminal, JSON, and Markdown output; risky
  upload/private/public publish config still blocks.
- Project-local capability inventory and routing for engineering, product, design, marketing, data,
  security, testing, research, release, browser QA, and swarm orchestration.
- Explicit frontend taste routing for public pages, cinematic landing pages, Google Stitch design
  generation, and legacy compatibility, while keeping Producer Studio on its operator-focused design
  system.
- Durable long-task checkpoints and context-budget rules that avoid reloading the full host
  capability catalog or forking oversized threads.
- CI high-severity dependency audit.
- Main-branch release workflow that computes a Conventional Commit release plan, validates
  release-range commit subjects, updates `package.json`, moves `CHANGELOG.md` Unreleased notes into
  a versioned section, commits `chore(release): vX.Y.Z`, and tags `vX.Y.Z`. The publish helper
  refreshes `origin/main` before planning and retries the atomic push when main advances during
  rapid consecutive merges. `pnpm version:plan` now exposes the pending tag, changelog note source,
  and main-only release-file ownership so PRs do not look like missing package bumps.
- Release workflow contract tests assert the main-only bot guard, high-severity dependency audit,
  release validation, version planning, release application, annotated tag creation, atomic push,
  and failed-tag cleanup wiring.
- CodeRabbit, GitHub Actions, CodeQL, Dependabot, SonarQube, Prettier, ESLint,
  eslint-config-prettier, Vitest, Playwright, TypeScript, modularity, secret-scan, changelog, and
  release hygiene gates.
- Studio has Tailwind CSS v4, shadcn-style config/primitives, Radix Tabs, lucide icons, GSAP, and
  `next/font` wired for the initial shell.
- Studio has a type-safe `next-intl` request/provider foundation with English and Turkish locale
  selection through a local cookie. Existing operator copy has not been migrated yet.
- Studio can list local persisted runs with counts, readiness/evidence status, remediation, and
  next-action visibility, then show a read-only run detail page with next action, readiness checks,
  warnings, approvals, ledger entries, blockers, production media evidence, shared review guidance,
  shared v1 workflow progress, and review artifacts. Missing/stale readiness points to
  `producer readiness --run <run_id>`; malformed or stale evidence points to
  `producer evidence --run <run_id>` and is not proof for blockers, production-media readiness, or
  next actions. Studio labels media rows as persisted artifact-record fallback until evidence is
  current, does not mutate run state or call providers, and reuses the CLI/core next-action contract
  in early states.
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
- Studio home and `/analytics` surface read-only manual analytics feedback from ignored local
  analytics artifacts. They show import/report status, data-quality guidance, and the next safe CLI
  command without calling YouTube APIs or mutating run state.
- Studio has a typed route-security contract for current read-only pages and disabled future action
  routes. Tests assert that all current App Router pages are covered as read-only, no Studio
  `route.ts` handlers exist, disabled actions require shared CLI/core service contracts, CSRF
  protection, durable evidence writes, and explicit approval targets, and public/scheduled publish
  risk remains disabled.
- Shared Studio mutation service contract foundations exist for future idea/script/cost/render
  approval actions and disabled upload/publish actions. Contracts validate future request payloads,
  bind each action to the CLI/core module/export, require CSRF protection, durable evidence, and
  explicit approval, and remain non-routable until guarded Studio action routes are intentionally
  implemented.
- Studio home renders a read-only mutation-service status panel showing disabled future action
  routes, CLI-ready approval contracts, route-security findings, and upload/publish risk boundaries
  without exposing web mutations.
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
- Roadmap and `.ai` guidance now include future Next.js Producer Studio, prompt editing, revision
  tracking, design direction, development preferences, versioning expectations, and Computer Use QA
  boundaries.
- Roadmap and `.ai` guidance now prioritize a channel-specific production loop: Render Plan +
  Contact Sheet MVP first, then local TTS, FFmpeg draft render, Studio read-only review, and manual
  analytics feedback.
- CodeRabbit is configured to auto-suggest and auto-assign `ogiboy` for PR review.
- Local SonarQube configuration targets project `uykuluk-scifi`; manual SonarCloud scans target
  `ogiboy_uykuluk-scifi`.
- `pnpm sonar` has successfully uploaded at least one local analysis to
  `http://localhost:9000/dashboard?id=uykuluk-scifi`.

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
pnpm producer decide render --run <run_id> --decision accepted-for-local-review --notes "<notes>" [--json]
pnpm producer decide render --run <run_id> --decision needs-revision --notes "<notes>" [--json]
pnpm producer decide render --run <run_id> --decision rejected --notes "<notes>" [--json]
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
  runs proved the safety architecture but not production-quality output. Qwen should stay a
  regression target while Mistral/Gemma/Turkish GGUF candidates are evaluated through the same
  approval, JSON, repetition, Turkish-label, word-floor, and operator-quality gates before any model
  becomes the recommended local default.
- No paid provider adapter is implemented. Exact cost quote approval remains separate from spend
  authorization. The internal execution boundary is ready for a future approved adapter, but no SDK,
  credential, network integration, or CLI mutation command exposes it.
- Current Next.js Studio is still review-only. Artifact previews now include grouped review
  metadata, and route-security requirements cover current read-only pages plus disabled future
  actions. Shared mutation service contract foundations exist, but concrete Studio CSRF/session
  handling and guarded mutation routes are not implemented yet.
- Locale infrastructure is ready, but full translation catalogs and a language selector are
  intentionally deferred.
- Prompt editing UI is planned but not implemented.
- Local prompt overrides are implemented as explicit ignored `prompts/local/*.md` paths configured
  in `producer.config.json` and recorded in prompt provenance. Prompt editing UI and prompt revision
  history remain future work; tracked defaults stay read-only runtime inputs, and Studio visibility
  remains read-only.
- Initial package artifact revision contracts are implemented for subtitles, scenes, popup-card
  package Markdown, and YouTube metadata. They are intentionally limited to
  `PRODUCTION_PACKAGE_GENERATED` before cost estimation or render work, refresh the
  production-package manifest, and invalidate stale evidence/readiness/render-plan artifacts. Richer
  per-field editing UX and post-estimate repair flows remain future work.
- Render planning does not render media, approve render execution, or reserve spend. It is a local
  review/planning artifact only.
- Local TTS currently provides a deterministic timing/reference WAV, a configured Piper shell-out,
  ignored-model setup helper, model/config digest provenance, and operator audio review Markdown. It
  does not commit voice models, approve render execution, upload, or publish. Deterministic-local
  evidence remains valid for timing/pipeline proof but is explicitly not a production voice
  candidate. A 2026-06-25 local Piper smoke generated WAV evidence successfully; subjective voice
  quality, pacing, and pronunciation still require operator listening before production use.
- FFmpeg draft render currently focuses on a local review MP4 using intro/outro source-card bookends
  or source-frame sequences, scene-timed background plates, subtitle burn-in, lower-third,
  popup-card, waveform, watermark overlays, voiceover audio, render manifest evidence, source-frame
  evidence/readiness summaries, a stable read-only FFmpeg review command in the manifest and
  draft-render evidence JSON, and an operator review checklist. Render-ready intro/outro MP4 clips
  for reuse outside the draft renderer and broader visual polish remain follow-up work.
- Upload and publish are intentionally disabled scaffolds.
- Manual analytics import/reporting and the basic read-only Studio analytics overview are local-only
  and operator-provided. Richer analytics comparisons, cohort-level confidence scoring, and YouTube
  Analytics API integration are not implemented.
- Run-path containment blocks pre-existing symbolic links. Hostile concurrent path replacement
  remains a local TOCTOU limitation because portable Node APIs do not expose directory-handle
  `openat` semantics.
- Brand, overlay, thumbnail, background, transition, icon, waveform, intro-frame, and outro-frame
  assets are present. The local draft renderer consumes intro/outro source frames when present.
  Editable source files, reusable rendered intro/outro clips, and font licensing notes remain useful
  additions.
- Sonar scan upload requires a local or cloud token through `SONAR_TOKEN` or Keychain; tokens must
  never be tracked.
- Stable git tags are present and release automation treats the latest reachable stable tag as the
  release base. Release planning fails if `package.json` drifts from that latest stable tag and uses
  exact-SHA legacy allowlist entries for the two historical non-conventional docstring commits.
