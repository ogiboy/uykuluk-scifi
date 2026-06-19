# QA Summary

Latest usage smoke report:

- `.ai/qa/artifacts/usage-smoke-20260618-234309/qa-report.md`
- `.ai/qa/artifacts/usage-smoke-20260618-234309/usage-smoke-summary.json`

Validated gates:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm qa:usage`
- `pnpm qa:browser`
- `pnpm check`
- `pnpm qa:modularity`
- `pnpm changelog:check`
- `pnpm format:check`
- `pnpm version:plan`
- SonarQube config/scripts are present; scanner upload requires a local token.
- `pnpm sonar` uploaded a local analysis to `http://localhost:9000/dashboard?id=uykuluk-scifi`.

Usage smoke coverage:

- Clean temporary project copy.
- Fresh `pnpm install`.
- `pnpm producer init` creates local config and directories.
- `pnpm producer doctor` passes in the clean mock setup and writes project-level JSON/Markdown
  diagnostics without creating a run.
- Direct doctor tests cover unavailable Ollama, missing configured model, invalid config, risky
  YouTube enablement, missing-asset warnings, bounded HTTP error evidence, duration, and durable
  reports.
- Mock default config keeps YouTube upload and public publish disabled.
- Script is blocked before idea approval.
- Package is blocked before script approval.
- Script approval is blocked if `script.md` changes after review.
- Production packaging is blocked if `script.md` changes after approval.
- Clean-copy QA revises a generated script through the CLI, verifies durable snapshots, and confirms
  the ledger/evidence bundle include the revision.
- Direct revision tests verify reviewed/approved scripts return to `SCRIPT_GENERATED`, stale script
  approvals and review artifacts become inactive, post-package revisions block, and re-review works.
- Full safe workflow reaches `READY_FOR_MANUAL_PRODUCTION`.
- Required artifacts, ledgers, cost files, readiness diagnostics, and evidence bundle exist.
- Evidence current state matches `state.json`.
- Readiness diagnostics current state matches `state.json` after a successful transition.
- Run-store tests reject malformed/schema-invalid state and preserve the last valid record when an
  invalid save is attempted.
- Evidence and clean-copy usage QA verify three runtime prompt provenance records with tracked
  `.ai/prompts/` source paths and SHA-256 hashes.
- Direct prompt-template coverage proves ideas, scripts, and production packages render the tracked
  operator defaults rather than separate hard-coded stage prompts.
- Direct Vitest coverage verifies deterministic mock output, Ollama diagnostics/usage metadata, and
  publish configuration plus approval boundaries.
- Content/asset guard tests verify clickbait title warnings and brand/overlay/intro/outro inventory.
- Budget preflight tests separately verify per-video, daily, and weekly blocks; ideas, scripts, and
  production packages do not call the configured provider or write generated artifacts after those
  blocks. A direct pricing-reservation test also proves the stage estimate is evaluated before the
  provider call.
- `pnpm security:dependencies` reports no known high-severity dependency vulnerabilities.
- Capability-routing docs pass formatting, changelog-marker, modularity, version-plan, full
  `pnpm check`, and clean-copy usage gates.
- Readiness passes with committed brand assets.
- Unit coverage confirms readiness blocks when `costs/estimate.json` disallows the next step or
  reports blocked reasons.
- Voice, render, upload, and publish are blocked by default.
- Playwright browser smoke verifies the initial Studio shell, module tabs, and cookie-based document
  locale through a production build/server.
- VS Code Problems reported zero workspace errors and zero warnings after the i18n setup.

Remaining known MVP limits:

- Ollama reachability/model-inventory diagnostics are covered with deterministic HTTP fixtures; live
  local Ollama generation remains environment-dependent because mock mode is the CI default.
- Asset packs now include thumbnails, background plates, transitions, popup icons, waveform
  overlays, and intro/outro frames. Editable source files, rendered intro/outro clips, and font
  licensing notes remain useful before render work.
- TTS, render, upload, and publish are intentionally disabled scaffolds.
