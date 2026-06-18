# QA Summary

Latest usage smoke report:

- `.ai/qa/artifacts/usage-smoke-20260618-025357/qa-report.md`
- `.ai/qa/artifacts/usage-smoke-20260618-025357/usage-smoke-summary.json`

Validated gates:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm qa:usage`
- `pnpm qa:browser`
- SonarQube config/scripts are present; scanner upload requires a local token.
- `pnpm sonar` uploaded a local analysis to `http://localhost:9000/dashboard?id=uykuluk-scifi`.

Usage smoke coverage:

- Clean temporary project copy.
- Fresh `pnpm install`.
- `pnpm producer init` creates local config and directories.
- Mock default config keeps YouTube upload and public publish disabled.
- Script is blocked before idea approval.
- Package is blocked before script approval.
- Script approval is blocked if `script.md` changes after review.
- Production packaging is blocked if `script.md` changes after approval.
- Full safe workflow reaches `READY_FOR_MANUAL_PRODUCTION`.
- Required artifacts, ledgers, cost files, readiness diagnostics, and evidence bundle exist.
- Evidence current state matches `state.json`.
- Run-store tests reject malformed/schema-invalid state and preserve the last valid record when an
  invalid save is attempted.
- Evidence and clean-copy usage QA verify three runtime prompt provenance records with SHA-256
  hashes.
- Readiness passes with committed brand assets.
- Unit coverage confirms readiness blocks when `costs/estimate.json` disallows the next step or
  reports blocked reasons.
- Voice, render, upload, and publish are blocked by default.
- Playwright browser smoke verifies the initial Studio shell, module tabs, and cookie-based document
  locale through a production build/server.
- VS Code Problems reported zero workspace errors and zero warnings after the i18n setup.

Remaining known MVP limits:

- Real Ollama mode is implemented but not exercised in QA because mock mode is the MVP default.
- Asset packs now include thumbnails, background plates, transitions, popup icons, waveform
  overlays, and intro/outro frames. Editable source files, rendered intro/outro clips, and font
  licensing notes remain useful before render work.
- TTS, render, upload, and publish are intentionally disabled scaffolds.
