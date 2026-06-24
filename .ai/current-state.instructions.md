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
- Script provider parse/transport failures persist safe run diagnostics without advancing state or
  storing raw provider output.
- Live local Ollama qwen3:8b smoke tests on 2026-06-23 verified safe idea generation, explicit idea
  approval, chunked section script generation, receipt persistence, and script review in both
  `no_think` and `think` modes without upload, render, or publish actions. Follow-up smoke after
  provider-failure diagnostics verified `no_think` reached `SCRIPT_REVIEWED` with 769 words and four
  warnings, while `think` reached `SCRIPT_REVIEWED` with 1051 words and only `too_short`.
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
  `SCRIPT_REVIEWED` runs in both `no_think` and `think`; `think` currently produces stronger script
  drafts but still misses the 1200-word floor. Current qwen3:8b drafts remain short and may carry
  content-review warnings such as long-form shortfall, fact-check needs, or weak intro hooks;
  further prompt tuning or a bounded long-form continuation pass is still needed before treating
  local model scripts as production quality.
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
- Manual analytics import/reporting is not implemented. Future analytics should start from
  operator-provided CSV/JSON before any YouTube Analytics API integration.
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
