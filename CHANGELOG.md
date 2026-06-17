# Changelog

All notable changes to UykulukSciFi Producer will be recorded here.

This project uses Conventional Commits. Release automation should preserve the marker below so
future generated release notes can be inserted predictably.

<!-- version list -->

## Unreleased

### Added

- Basic type-safe `next-intl` foundation for English and Turkish Studio locales.
- Unit and browser coverage for locale normalization and cookie-based document language.

### Changed

- Browser QA now builds and serves the production Studio instead of running a file-watching dev
  server.

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
