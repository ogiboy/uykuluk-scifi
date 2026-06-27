# Changelog

All notable changes to UykulukSciFi Producer will be recorded here.

This project uses Conventional Commits. Release automation should preserve the marker below so
future generated release notes can be inserted predictably.

<!-- version list -->

## Unreleased

_No unreleased changes yet._

## v0.31.0 (2026-06-27)

### Features

- add approval command JSON output for automation-friendly approval records

## v0.30.0 (2026-06-27)

### Features

- add `producer render --json` for automation-friendly draft render manifest inspection

## v0.29.0 (2026-06-27)

### Features

- add voice json output (3a5c35d)

## v0.28.0 (2026-06-27)

### Features

- add `producer voice --json` for automation-friendly voiceover metadata inspection
- add `producer review script --json` for automation-friendly review inspection

## v0.27.0 (2026-06-27)

### Features

- add generation json output (a3441fe)

## v0.26.0 (2026-06-27)

### Features

- add package json output (13327c6)

## v0.25.0 (2026-06-27)

### Features

- add `producer ideas --json` and `producer script --json` for automation-friendly generation
  inspection
- add `producer package --json` for automation-friendly production manifest inspection
- add `producer render-plan --json` for automation-friendly render-plan inspection

## v0.24.0 (2026-06-27)

### Features

- add evidence json output (10e160e)

## v0.23.0 (2026-06-27)

### Features

- add `producer evidence --json` for automation-friendly evidence bundle inspection
- add `producer estimate --json` for automation-friendly cost quote inspection

## v0.22.0 (2026-06-27)

### Features

- add readiness json output (7ac9382)

## v0.21.0 (2026-06-27)

### Features

- add `producer readiness --json` for automation-friendly readiness diagnostics
- add `producer doctor --json` for automation-friendly local diagnostics

## v0.20.0 (2026-06-27)

### Features

- add json run listing (fd955eb)

## v0.19.0 (2026-06-27)

### Features

- add `producer list-runs --json` for automation-friendly run inspection
- add `producer status --latest` for quick inspection of the newest run

## v0.18.0 (2026-06-27)

### Features

- show manual analytics feedback status on the Studio home page

## v0.17.0 (2026-06-27)

### Features

- show latest-run readiness and next safe action on the Studio home page

## v0.16.0 (2026-06-27)

### Features

- warn in `producer doctor` when local FFmpeg/ffprobe tools are unavailable for draft render

## v0.15.0 (2026-06-27)

### Features

- show persisted producer doctor status on the Studio home page

## v0.14.0 (2026-06-27)

### Features

- add a read-only Studio `/doctor` route for persisted producer diagnostics

## v0.13.0 (2026-06-27)

### Features

- add a read-only Studio `/prompts` route for runtime prompt inventory review

## v0.12.0 (2026-06-27)

### Features

- add read-only Studio runtime prompt inventory for tracked defaults and local overrides

## v0.11.0 (2026-06-27)

### Features

- check prompt overrides (ca80ab7)

## v0.10.0 (2026-06-27)

### Features

- add local prompt overrides (301052f)

## v0.9.0 (2026-06-27)

### Features

- add explicit ignored local prompt overrides with prompt provenance for provider-backed stages
- report missing, empty, or unsafe local prompt overrides in `producer doctor`
- add bounded package artifact revision events for subtitles, scenes, popup-card package Markdown,
  and YouTube metadata before cost/render work starts

## v0.8.1 (2026-06-27)

### Fixes

- clarify recorded media evidence (4a02623)

## v0.8.0 (2026-06-27)

### Features

- share manual analytics data-quality summaries between CLI reports and Studio overview
- show approval ledger entries and warning details in CLI status output
- record local Piper model and config provenance in voiceover evidence and review artifacts
- show approval ledger entries and warnings in Studio run detail
- show approval, warning, and artifact counts in the Studio run index
- show readiness remediation in the Studio run index
- show evidence status in the Studio run index
- show readiness check messages in Studio run detail
- show production media evidence details in Studio run detail
- show production media evidence details in operator status output
- add an operator-readable production media summary to evidence Markdown
- summarize draft-render source-frame usage in evidence and readiness output
- report ffprobe-validated draft render media details in readiness output
- show voiceover WAV and ffprobe render evidence in Studio read-only artifact previews
- show render plan, voiceover, and draft render status in the CLI run status summary
- add a read-only Studio visual asset inventory page backed by configured asset guard checks
- validate local draft renders with `ffprobe` media evidence before recording render completion
- add a read-only Studio analytics feedback page for local manual analytics artifacts, including
  imported totals, mapped/unmapped run visibility, top videos, report preview, and safe next action
  guidance
- add non-causal repeat / avoid-without-revision / test-next recommendations in the local manual
  analytics report, with simple confidence/missingness framing for imported performance fields
- add import data-quality summary on the read-only Studio analytics page
- add analytics report refresh and Studio stale/missing/current report preview status
- add typed Studio route-security contract and negative tests for read-only pages plus disabled
  future action routes
- add shared Studio mutation service contract foundations for future guarded approval/upload/publish
  actions without enabling web mutations
- add read-only Studio mutation-service status panel showing disabled future actions and
  route-security findings

### Fixes

- harden release workflow contract tests for main-only version, changelog, and tag automation
- clarify recorded production media rows as artifact records, not current evidence proof
- label CLI status production media rows as artifact-record fallback until evidence is current
- keep Studio asset inventory directory definitions precise for static analysis
- avoid treating unavailable Studio evidence as no blocked actions or media proof
- mark malformed or stale Studio evidence bundles with a regeneration command
- mark malformed or stale CLI status evidence with a regeneration command
- mark missing, malformed, or stale Studio readiness diagnostics with a regeneration command
- mark missing, malformed, or stale CLI status readiness diagnostics with a regeneration command
- show readiness check summaries and next actions in CLI status output
- show blocked-action evidence details in CLI status and Studio run detail
- show concrete run ids in evidence Markdown next-action commands
- show concrete run ids in CLI status and Studio next-action commands
- add readiness next-action guidance for render planning, voiceover, render approval, and local
  draft render
- show readiness next-action commands in Studio run detail
- print `producer readiness` next-action guidance in terminal and Markdown output
- print `producer doctor` next-action guidance in terminal output
- fail release planning when `package.json` drifts from the latest stable tag
- add next-action guidance for blocked Ollama and publish-default doctor diagnostics
- clear Sonar quality-gate findings for local media evidence changes
- make usage smoke prove the safe local render-plan, voiceover, and draft-render loop
- suppress the known Studio local asset-inventory Turbopack tracing warning

## v0.7.2 (2026-06-25)

### Tooling

- make `version:plan` explain pending tags, changelog source, and main-only release ownership

## v0.7.1 (2026-06-25)

### Documentation

- refresh capability routing for current plugin, MCP, and subagent usage

### Fixes

- reject English scientific leftovers and repeated qwen3 inspection verbs in ideas
- reject repeated weak qwen3 idea journey and clue boilerplate
- surface safe idea failure diagnostics in CLI status and Studio run detail
- fail closed on repeated qwen3 idea fit/premise boilerplate after bounded repairs
- surface safe script failure diagnostics in CLI status and Studio run detail
- keep Studio read-only next-action guidance aligned with CLI status before evidence exists
- keep early `producer status` next-action guidance useful before evidence exists
- avoid Ollama continuation grammar warnings from large schema length bounds
- fail closed when script continuations still miss the long-form floor
- recover qwen3 script blocker retries with stale diagnostic cleanup

## v0.7.0 (2026-06-25)

### Features

- add voiceover review artifact (d6eafce)
- add draft review artifact (589ab9d)
- add intro outro draft timeline (f2faed6)

## v0.6.0 (2026-06-25)

### Features

- compose draft review overlays (7c8015a)

## v0.5.1 (2026-06-25)

### CI

- retry stale main publish (cdccc48)

## v0.5.0 (2026-06-25)

### Features

- add TTS next-action diagnostics (315392f)

## v0.4.0 (2026-06-25)

### Features

- add run-linked performance summaries (d1ef948)
- use scene-timed draft render timeline (960c3c4)
- group run artifact previews (061395b)

## v0.3.1 (2026-06-25)

### Chores

- update dependencies to latest versions (270c48b)

## v0.3.0 (2026-06-25)

### Documentation

- refresh capability routing inventory (12cc0cd)

### Fixes

- address workflow review findings (1fda5a1)
- clear sonar diagnostics (c55b0e2)

### Features

- harden local production workflow (a4e30d2)

## v0.2.1 (2026-06-25)

### Chores

- bump the github-actions group with 3 updates (97e10ff)

## v0.2.0 (2026-06-24)

### Added

- Main-branch release workflow for Conventional Commit version planning, `package.json` updates,
  changelog section promotion, release commits, and stable `vX.Y.Z` tags.
- Typed release policy tests covering version bump calculation, legacy commit handling, and
  changelog generation.
- `producer render-plan` command that writes a deterministic render plan, storyboard contact sheet,
  and asset provenance from a verified production package and tracked visual assets.
- Disabled-by-default `producer voice` local TTS foundation that writes voiceover WAV/audio metadata
  after readiness, script approval, production-package integrity, and render-plan evidence pass.
- Optional `local-piper` TTS adapter configuration for a local Piper binary and ignored voice model
  paths, alongside a deterministic local reference adapter for CI-safe timing artifacts.
- `pnpm tts:piper:setup` helper that downloads a pinned Turkish Piper voice from Hugging Face into
  ignored `models/`, writes the Piper-compatible config alias, and prints the matching local config
  override.
- `producer approve render` and `producer render` local FFmpeg draft-render flow with exact
  render-plan/voiceover approval, MP4 output, manifest evidence, and draft-render readiness/evidence
  status.
- Read-only Studio run index and run detail routes backed by local run/evidence/readiness summaries.
- Read-only Studio artifact preview excerpts for review text/JSON artifacts, with binary draft
  render media limited to metadata.
- `producer analytics import` and `producer analytics report` for local operator-provided CSV/JSON
  performance feedback, with ignored dataset/report artifacts and non-causal summary guidance.
- Render-plan and FFmpeg draft-render provenance for committed intro/outro source-frame sequences.
- Basic type-safe `next-intl` foundation for English and Turkish Studio locales.
- Unit and browser coverage for locale normalization and cookie-based document language.
- Typed runtime loading for tracked idea, scriptwriter, and production-package prompt defaults.
- `producer doctor` diagnostics for project config, mock/Ollama readiness, asset inventory, and safe
  publish defaults, with local JSON/Markdown evidence.
- Attributable script revisions with before/after snapshots, review/approval invalidation, ledger
  events, and evidence-bundle visibility.
- Project-local capability inventory, task routing, frontend taste selection, swarm/context rules,
  and long-goal checkpoints.
- Versioned future paid-generation JSON-plus-Markdown quote bundles with exact digest approval, live
  package/config/pricing/budget revalidation, evidence visibility, and a dedicated resumable
  workflow state.
- Project-wide atomic cost reservations with one-time approved quote-line consumption, integer USD
  micros, idempotent operation ids, recoverable settlement, uncertain outcomes, explicit
  reconciliation, and evidence summaries.
- Internal adapter-bound reserved-provider execution with durable execution claims, provider/model
  quote matching, local at-most-once callback dispatch, bounded timeout/abort, fail-closed outcome
  classification, exact settlement, and hashed request-id evidence.
- Versioned production-package manifests covering voiceover, subtitles, scenes, YouTube metadata,
  package Markdown, approved-script provenance, and exact artifact digests.
- Ollama `thinkingMode` config (`default`, `think`, `no_think`) plus stage output-token caps for
  ideas, scripts, and production packages.
- Sectioned script-generation receipts for hook, context, development, and outro provider calls.
- Chunked script-section expansion receipts so local Ollama script drafts can be assembled from
  smaller bounded JSON payloads.

### Changed

- Browser QA now builds and serves the production Studio instead of running a file-watching dev
  server.
- `producer status` now defaults to an operator-readable summary with state, evidence, artifact,
  warning, and next-action details; `--json` preserves raw persisted state output for automation.
- `producer doctor` now reports TTS provider readiness and blocks enabled `local-piper` mode when
  the configured binary, model, or config file is missing.
- Script review, approval, and production packaging now require the same SHA-256 content digest.
- Prompt provenance now records the tracked source path in addition to the rendered prompt hash.
- Runtime prompt defaults now live under `prompts/defaults/` so the CLI no longer depends on `.ai/`
  development files.
- Script review now reports 20-minute target shortfalls and blocking findings for incomplete or
  non-Turkish provider output.
- Script approval now requires explicit `--acknowledge-warnings` confirmation when review warnings
  remain.
- Script generation now uses bounded section-level provider calls instead of one large script call.
- Script section generation now keeps the global 20-minute prompt target out of individual local
  provider calls and expands each section through three smaller chunks.
- Ollama JSON response formatting now uses explicit schemas for idea, script-section, and
  production-package payloads where structured local output is required.
- Cost estimation no longer records an incurred cost event; quote approval is explicitly separate
  from future spend reservation and settlement.
- Hard-budget checks now include active, settlement-pending, and uncertain reservations across runs
  so concurrent work cannot overbook per-video, daily, or weekly limits.
- Explicit public publish config now passes the configuration guard only when the run also contains
  explicit publish approval; execution remains an intentionally disabled MVP scaffold.
- Runtime schemas now use current Zod 4 APIs (`z.strictObject`, top-level string formats,
  `z.iso.datetime`, and `z.int`) with regression coverage preventing deprecated Zod 3 patterns.
- Evidence and readiness now surface render-plan availability, warning when missing and blocking
  when partial or malformed render-plan artifacts exist.
- Evidence and readiness now surface voiceover audio availability, warning when absent and blocking
  when partial, stale, or malformed voiceover artifacts exist.
- Evidence next-command guidance now moves from voiceover to render approval and local draft render
  review when the required artifacts are present.

### Fixed

- Release commit checks now scan the actual release range instead of an empty range.
- Release commit checks now ignore GitHub pull-request synthetic merge subjects even when checkout
  history hides parent metadata.
- Local AgentDB/RuVector database files are no longer tracked as repository artifacts.
- Ollama-backed idea and production-package stages now schema-validate provider JSON, accept common
  root-array and snake_case variants, assign deterministic local idea ids, and strip leading
  thinking traces before writing reviewable artifacts.
- Ollama-backed idea parsing now normalizes localized Turkish difficulty/risk labels while still
  rejecting English operator-facing idea payloads or rating-only `fit` fields.
- Script generation now rejects incomplete or English-labeled section output before writing
  `script.md`, and script approval rejects reviewed scripts with blocking findings.
- Script generation provider parse/transport failures now persist safe run diagnostics without
  advancing workflow state or storing raw provider output.
- Production build now emits a Node-runnable CLI without compiling tests into `dist/`, and build
  smoke verifies the compiled CLI can initialize a fresh project from another working directory.
- Provider-backed idea, script, and production-package generation now blocks before provider calls
  and artifact writes when stage pricing would exceed existing per-video, daily, or weekly budgets.
- Production packaging now fails closed when `script.md` changes after review or approval.
- Readiness now rejects malformed, stale, tampered, hard-budget-blocked, or unapproved nonzero cost
  quotes instead of trusting editable allow/block fields.
- Run loading now rejects malformed or schema-invalid state, and JSON persistence uses atomic
  replacement.
- Evidence bundles now include runtime prompt key/hash provenance for ideas, scripts, and production
  packages.
- Provider diagnostics and publish configuration/approval boundaries now have direct Vitest
  coverage.
- CI now audits dependencies for high-severity known vulnerabilities.
- Successful readiness diagnostics now record the final transitioned run state instead of the
  pre-transition state.
- Content review now warns on excessive clickbait title framing.
- Content review now detects intro hooks after Markdown title and section headings instead of only
  scanning the first raw lines.
- Evidence next-command guidance now recommends `--acknowledge-warnings` for reviewed scripts with
  warnings and avoids approval guidance while review blockers remain.
- Script review Markdown now shows the matching next approval command or blocker remediation
  guidance.
- Asset readiness now inventories intro and outro inputs in addition to brand and overlay files.
- Cost and reservation ledgers now reject malformed or foreign-run rows instead of accepting
  unvalidated JSON.
- Stale reservation-lock recovery now preserves a live owner instead of allowing overlapping
  critical sections after the age threshold.
- Run state, ledger, artifact, and cost path helpers now reject malformed or traversal-shaped run
  identifiers, and run loading rejects state whose embedded id differs from its directory.
- Artifact reads, writes, and persisted artifact lists now reject absolute, traversal-shaped,
  Windows-style, reserved-device, trailing-dot, malformed, control-character, or oversized relative
  paths before side effects.
- Cost estimation and readiness now fail closed when any generated production-package artifact or
  its manifest is missing, malformed, foreign, or changed; evidence bundles report the verified
  manifest digest or blocking integrity reason.
- Run state, ledger, cost, reservation, lock, and artifact access now rejects existing symbolic
  links beneath `runs/` and multiply-linked final files; text artifact writes also use atomic
  temporary-file replacement.

## 0.1.0 - 2026-06-17

### Added

- Initial approval-gated TypeScript CLI producer workflow.
- Mock-first provider layer with Ollama adapter scaffold.
- Run state machine, approval ledger, cost estimate, readiness diagnostics, and evidence bundle.
- Disabled voice, render, upload, and publish scaffolds.
- UykulukSciFi visual asset inventory, including brand, overlays, thumbnails, backgrounds,
  transitions, popup icons, waveform overlays, and intro/outro frames.
- Basic Next.js Producer Studio workspace shell under `apps/studio`.
- CI, CodeQL, Dependabot, SonarQube, modularity, secret-scan, changelog, and formatting gates.
