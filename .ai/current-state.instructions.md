# Current State

## Implemented

- TypeScript CLI project.
- Mock-first provider layer with Ollama adapter scaffold.
- Typed runtime loading of tracked `prompts/defaults/` product prompt defaults for ideas, scripts,
  and production packages, with prompt key/source/hash provenance.
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
- Render Plan + Contact Sheet MVP that consumes the verified production-package manifest and tracked
  assets, then writes `production/render_plan.json`, `production/storyboard_contact_sheet.md`, and
  `production/asset_provenance.json` without FFmpeg render, upload, paid provider, or public publish
  execution.
- Evidence and readiness now surface render-plan presence; missing render plans warn, while partial
  or malformed render-plan artifacts block readiness.
- Disabled-by-default local voiceover generation. `producer voice` requires local TTS config,
  `READY_FOR_MANUAL_PRODUCTION`, explicit script approval, a verified production package, and valid
  render-plan evidence before it writes `production/audio/voiceover.wav` and
  `production/audio/voiceover.meta.json`. `deterministic-local` is a timing/reference adapter;
  `local-piper` shells out to a configured local Piper binary and ignored model path.
- `pnpm tts:piper:setup` downloads the pinned CPU-friendly Turkish
  `speaches-ai/piper-tr_TR-fahrettin-medium` model into ignored `models/` and prints the matching
  local config override for `local-piper`.
- Approval-gated local FFmpeg draft render. `producer approve render` records approval for the exact
  current render-plan and voiceover digests, then `producer render` requires `RENDER_APPROVED`
  before writing `production/render/draft.mp4` and `production/render/render_manifest.json`.
- Provider-backed idea and production-package stages schema-validate and normalize common Ollama
  JSON variants before artifact writes, while rejecting malformed or English operator-facing
  payloads fail-closed.
- Ollama provider config supports `thinkingMode` (`default`, `think`, `no_think`) and stage-specific
  `maxOutputTokens` caps that are passed to Ollama as `num_predict`.
- Script generation uses bounded hook/context/development/outro provider calls, writes
  `script.sections.json` draft and expansion-chunk receipts, and assembles `script.md` only after
  all sections pass blocking quality checks.
- Script expansion prompts include the previous expansion chunks from the same section so local
  models have explicit context to continue from rather than repeating section-level sentence loops.
- Script generation now runs up to two bounded long-form continuation passes when the assembled
  script remains below the 1200-word review floor. Continuations extend the existing
  `Sinematik Gelişme` section, add `continuation` receipts to `script.sections.json`, and are
  included in prompt provenance, token totals, cost recording, and blocker checks.
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
- Script section and continuation content blockers now get one bounded retry using only safe blocker
  summaries and already accepted context. Rejected raw provider text is discarded; the accepted
  `script.sections.json` receipt records retry evidence with prompt/content hashes, token estimates,
  and duration for the rejected attempt.
- Live qwen3:8b `no_think` QA after the bounded script content-blocker retry on 2026-06-24 exercised
  the retry path but still failed closed without `script.md`: the latest run reached `outro`
  expansion chunk 3, then reported
  `repeated_sentence_loop(repeatCount=3;sentenceFingerprint=be3048d09737d3ab) after 1 retry`. State
  remained `IDEA_APPROVED`, diagnostics stayed raw-output-free, and no upload/render/publish action
  ran.
- Script continuation parsing accepts additional bounded malformed local-model `"text"` wrappers,
  including trailing commas, missing closing quotes, and short external notes, only after the
  extracted Turkish continuation still passes complete-sentence and exact-label validation.
- Script expansion prompts now explicitly warn against repeated sentence skeletons, metaphors, and
  visual directions across the draft and already-written chunks.
- Script provider parse/transport failures and content-blocker failures persist safe run diagnostics
  without advancing state or storing raw provider output. Section content blockers include the
  section id, pass, and expansion chunk when available.
- Live local Ollama qwen3:8b smoke tests on 2026-06-23 verified safe idea generation, explicit idea
  approval, chunked section script generation, receipt persistence, and script review in both
  `no_think` and `think` modes without upload, render, or publish actions. Follow-up smoke after
  provider-failure diagnostics verified `no_think` reached `SCRIPT_REVIEWED` with 769 words and four
  warnings, while `think` reached `SCRIPT_REVIEWED` with 1051 words and only `too_short`.
- Live local Ollama qwen3:8b `no_think` QA on 2026-06-24 verified `producer doctor`, real idea
  generation, explicit idea approval, bounded continuation recovery after JSON parse failures, and a
  successful 1283-word `SCRIPT_REVIEWED` run with 18 provider receipts and two continuation
  receipts. The same run exposed production-quality defects in qwen3 output: repeated sentence
  loops, malformed labels such as `Anlatyıcı:`, weak idea diversity, and unsupported science
  framing. Guards now block malformed labels and repeated loops; repeat live QA is still required
  after prompt tuning before treating qwen3 drafts as production-ready.
- Live local Ollama qwen3:8b `think` QA on 2026-06-24 verified `producer doctor` and exposed another
  idea-stage quality gap: the model returned duplicated titles/premises and only six usable ideas.
  Idea parsing now rejects duplicated local-model titles or premises fail-closed. The repeated
  `think` run stopped before artifact advancement with
  `Invalid ideas provider response: ideas.6.premise: Ideas must be meaningfully distinct.`
- Follow-up qwen3:8b `think` QA after planner prompt tuning produced exactly eight ideas, but the
  list was still not operator-reviewable: repeated generic title motifs, repeated premise frames,
  and common `UykulukSciFi` spelling glitches remained. The parser now normalizes common
  `UykulukSci`/`UykulukSciyFi` brand typos, rejects repeated generic title motifs, and rejects
  repeated premise frames across the idea list. The latest live run stopped before artifact
  advancement with
  `Invalid ideas provider response: ideas.2.title: Ideas must be meaningfully distinct.` Prompt-only
  tuning was therefore not enough.
- Idea generation now retries up to two bounded repair attempts with parser validation feedback when
  a local-provider response fails `Invalid ideas provider response` validation. Repair attempts
  write no raw rejected output, record ledger warnings, include `ideas.json.repair` metadata on
  success, aggregate token/duration evidence across attempts, and still fail closed without
  artifacts if the final repair response is invalid.
- Idea parsing now also rejects repeated sentence loops inside idea fields, malformed `Uykul...`
  brand fragments, English scientific lane terms such as `exoplanet`, and repeated generic `fit`
  explanations across a slate. Planner and repair prompts now ask for Turkish lane terms and
  slot-specific `fit` explanations.
- Live local Ollama qwen3:8b `think` QA after the retry loop on 2026-06-24 verified that the retry
  path is exercised and remains fail-closed: the initial response failed on a repeated premise
  frame, the repair response failed on repeated `yıldız` title motifs, the run stayed `NEW`, no
  `ideas.json` was written, and the ledger contains both the retry warning and final error. The next
  product improvement is repair-prompt/idea-quality tuning, not relaxing the guard.
- Live local Ollama qwen3:8b `think` QA after forced repair slots and stricter idea guards on
  2026-06-24 produced an `IDEAS_GENERATED` run after one or two repair warnings, proving the repair
  loop can recover real local output while preserving evidence. Manual review still found the ideas
  below production quality, but weak repeated sentence, malformed brand, English lane, and duplicate
  `fit` cases are now blocked or prompted against. A temp QA approval of one idea then exercised
  script generation in `no_think` and `think`: both remained fail-closed without `script.md`.
  `no_think` hit `repeated_sentence_loop`; after adding malformed local-model `"text"` wrapper
  recovery for continuation payloads, the latest `think` retry no longer stopped at `expected JSON`
  and instead failed closed on `repeated_sentence_loop`.
- Live qwen3:8b `think` retry after section anti-repetition context and contextual script blocker
  diagnostics on 2026-06-24 remained fail-closed without `script.md`, but the diagnostics now
  identify the failing boundary: `development` section, `expansion chunk 1`, blocker
  `malformed_production_label`.
- Script section prompts now include an exact-label checklist that permits only `Anlatıcı:` and
  `Görsel:` with Turkish accents.
- Live qwen3:8b `think` retry after exact-label prompt/guard tightening on 2026-06-24 still remained
  fail-closed without `script.md`; diagnostics now identify `context` section, `expansion chunk 1`,
  blocker `malformed_production_label`. This confirms the prompt-only label discipline is not enough
  for qwen3 and the next decision is whether to keep strict regeneration or add an auditable bounded
  label-repair step.
- Live qwen3:8b `no_think` QA after bounded label repair on 2026-06-24 used
  `/private/tmp/uykuluk-live-ollama-current-nFMiuN`. Doctor passed, ideas generated, `idea_001` was
  explicitly approved, and script retries stayed fail-closed without `script.md`. The first retry
  stopped at continuation `expected JSON`; broader malformed-wrapper recovery moved the next live
  failure to `outro` expansion chunk 3 `repeated_sentence_loop`; stricter anti-loop prompt wording
  then moved the latest failure to `development` expansion chunk 1 `malformed_production_label`.
  State stayed `IDEA_APPROVED`, proving retries remain safe while qwen3 label quality remains the
  next blocker.
- A later retry against the same live run after safe malformed-label diagnostic categories again
  stayed fail-closed without `script.md`, this time at assembled-script review with
  `repeated_sentence_loop`. This confirms qwen3 output remains nondeterministic and the next tuning
  target is still production quality, not loosening blockers.
- A follow-up retry after safe repeated-loop diagnostics stayed fail-closed without `script.md` and
  reported `repeated_sentence_loop(repeatCount=3;sentenceFingerprint=d425f4180b4005fa)`. State
  remained `IDEA_APPROVED`, proving the more specific diagnostics still preserve fail-closed
  behavior.
- Evidence bundle generation with production-package integrity status and manifest digest.
- Evidence next-command guidance reflects script review blockers and required warning
  acknowledgement before script approval.
- `producer status` now defaults to an operator-readable summary with state,
  approval/warning/artifact counts, evidence availability, recent artifacts, and next safe action;
  `--json` preserves raw persisted state output for automation.
- Readiness diagnostics that strictly parse and revalidate persisted cost quotes, live hard budgets,
  complete production-package integrity, and exact paid-generation cost approval when required.
- Final readiness diagnostics agree with the post-transition run state.
- Disabled upload and publish placeholders.
- Basic Next.js Producer Studio shell under `apps/studio` with read-only run index and run detail
  routes backed by local run/evidence/readiness service contracts.
- Visual asset pack imported under `assets/`.
- Clean-copy usage smoke script.
- Production build emits a Node-runnable `dist/cli.js` and `pnpm build:smoke` verifies the built CLI
  starts and can initialize a fresh project from an arbitrary working directory.
- Direct mock/Ollama provider diagnostics and upload/publish safeguard tests.
- `producer doctor` project diagnostics with durable local JSON/Markdown evidence for config,
  provider/model availability, local TTS/Piper readiness, assets, and publish defaults.
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
  a versioned section, commits `chore(release): vX.Y.Z`, and tags `vX.Y.Z`.
- CodeRabbit, GitHub Actions, CodeQL, Dependabot, SonarQube, Prettier, ESLint,
  eslint-config-prettier, Vitest, Playwright, TypeScript, modularity, secret-scan, changelog, and
  release hygiene gates.
- Studio has Tailwind CSS v4, shadcn-style config/primitives, Radix Tabs, lucide icons, GSAP, and
  `next/font` wired for the initial shell.
- Studio has a type-safe `next-intl` request/provider foundation with English and Turkish locale
  selection through a local cookie. Existing operator copy has not been migrated yet.
- Studio can list local persisted runs and show a read-only run detail page with next safe action,
  readiness status, warning/approval counts, and review artifact availability. It does not mutate
  run state or call providers.
- Studio run detail includes read-only artifact preview excerpts for scripts, reviews, production
  packages, render plans, contact sheets, evidence, readiness, and render manifests. Binary media is
  intentionally limited to metadata.
- Manual analytics feedback foundation. `producer analytics import --file <path>` accepts
  operator-provided CSV/JSON performance exports and writes ignored local
  `analytics/performance.json` plus `analytics/performance_report.md`. `producer analytics report`
  prints the current report. No YouTube API, upload, publish, or causal claim is introduced.
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
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer approve script --run <run_id> --acknowledge-warnings # when review warnings remain
pnpm producer package --run <run_id>
pnpm producer render-plan --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
pnpm producer status --run <run_id>
pnpm producer status --run <run_id> --json
pnpm producer list-runs
pnpm producer voice --run <run_id>
pnpm producer render --run <run_id>
pnpm producer analytics import --file <path>
pnpm producer analytics report
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

- Ollama doctor checks server reachability and configured model inventory, but live local-model QA
  is environment-dependent and not part of CI. Live qwen3:8b QA on 2026-06-23 verified successful
  `SCRIPT_REVIEWED` runs in both `no_think` and `think`; `think` produced stronger script drafts but
  still missed the 1200-word floor before bounded continuation was implemented. Live qwen3:8b
  `no_think` QA on 2026-06-24 proved bounded continuation can recover to 1200+ words, but output
  quality remained below production expectations until malformed-label and repetition blockers were
  added. Follow-up `think` runs still produced weak duplicated or repeated-frame ideas and are now
  blocked by distinct-title, distinct-premise, repeated-title-motif, and repeated-premise-frame
  guards. A bounded two-attempt idea retry/repair loop now exists and live qwen3 QA proved the first
  repair path fails closed, but the repaired qwen3 idea slate is still not production quality.
  Scripts may still carry review warnings such as fact-check needs, weak intro hooks, or unsupported
  speculative framing.
- No paid provider adapter is implemented. Exact cost quote approval remains separate from spend
  authorization. The internal execution boundary is ready for a future approved adapter, but no SDK,
  credential, network integration, or CLI mutation command exposes it.
- Current Next.js Studio is still review-only. Richer media-specific previews, route security
  requirements, shared read/write service contracts, and guarded mutation routes are not implemented
  yet.
- Locale infrastructure is ready, but full translation catalogs and a language selector are
  intentionally deferred.
- Prompt editing UI is planned but not implemented.
- Local prompt overrides and revision history are not implemented; tracked defaults are read-only
  runtime inputs.
- Revision contracts for subtitles, scenes, popup cards, and YouTube metadata are not implemented.
- Render planning does not render media, approve render execution, or reserve spend. It is a local
  review/planning artifact only.
- Local TTS currently provides a deterministic timing/reference WAV, a configured Piper shell-out,
  and an ignored-model setup helper. It does not commit voice models, approve render execution,
  upload, or publish. Real Piper voice quality still needs local QA before production use.
- FFmpeg draft render currently focuses on a simple local review MP4 using a background plate,
  subtitle burn-in, watermark overlay, and voiceover audio. More complete scene timing, popup card,
  waveform, intro/outro, and composition polish remain follow-up work.
- Upload and publish are intentionally disabled scaffolds.
- Manual analytics import/reporting is local-only and operator-provided. Richer analytics
  comparisons, Studio analytics views, and YouTube Analytics API integration are not implemented.
- Run-path containment blocks pre-existing symbolic links. Hostile concurrent path replacement
  remains a local TOCTOU limitation because portable Node APIs do not expose directory-handle
  `openat` semantics.
- Brand, overlay, thumbnail, background, transition, icon, waveform, intro-frame, and outro-frame
  assets are present. Editable source files, rendered intro/outro clips, and font licensing notes
  remain useful additions.
- Sonar scan upload requires a local or cloud token through `SONAR_TOKEN` or Keychain; tokens must
  never be tracked.
- No stable git tag is present in this worktree snapshot unless the main release workflow has run.
  The first automated release treats reachable history as the release range and uses exact-SHA
  legacy allowlist entries for the two historical non-conventional docstring commits.
