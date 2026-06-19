# Changelog

All notable changes to UykulukSciFi Producer will be recorded here.

This project uses Conventional Commits. Release automation should preserve the marker below so
future generated release notes can be inserted predictably.

<!-- version list -->

## Unreleased

### Added

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
- Versioned production-package manifests covering voiceover, subtitles, scenes, YouTube metadata,
  package Markdown, approved-script provenance, and exact artifact digests.

### Changed

- Browser QA now builds and serves the production Studio instead of running a file-watching dev
  server.
- Script review, approval, and production packaging now require the same SHA-256 content digest.
- Prompt provenance now records the tracked source path in addition to the rendered prompt hash.
- Cost estimation no longer records an incurred cost event; quote approval is explicitly separate
  from future spend reservation and settlement.
- Hard-budget checks now include active, settlement-pending, and uncertain reservations across runs
  so concurrent work cannot overbook per-video, daily, or weekly limits.
- Explicit public publish config now passes the configuration guard only when the run also contains
  explicit publish approval; execution remains an intentionally disabled MVP scaffold.

### Fixed

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
