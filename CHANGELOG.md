# Changelog

All notable changes to UykulukSciFi Producer will be recorded here.

This project uses Conventional Commits. Release automation should preserve the marker below so
future generated release notes can be inserted predictably.

<!-- version list -->

## Unreleased

_No unreleased changes yet._

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
