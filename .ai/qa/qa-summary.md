# QA Summary

Latest usage smoke report:

- `.ai/qa/artifacts/usage-smoke-20260619-115623/qa-report.md`
- `.ai/qa/artifacts/usage-smoke-20260619-115623/usage-smoke-summary.json`

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
- Run-ID boundary tests reject path traversal, absolute paths, separators, whitespace, invalid
  prefixes, and oversized identifiers across state, ledger, artifact, cost, reservation, and CLI
  entry points while preserving generated IDs and valid run listing.
- Artifact-path boundary tests reject POSIX/Windows absolute paths, dot segments, backslashes,
  duplicate/trailing separators, whitespace, controls, non-ASCII names, malformed segments, and
  oversized paths before filesystem or ledger mutation. Windows device basenames and trailing-dot
  aliases are also blocked; persisted unsafe artifact lists fail closed.
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
- Paid-generation cost approval tests verify exact JSON-plus-Markdown quote binding, displayed-stage
  tamper rejection, quote tamper rejection after approval, live hard-budget rechecks, hard-budget
  non-override, no extra incurred-cost event, and unnecessary zero-cost approval rejection.
- Cost reservation tests verify same-line concurrency exclusion, operation-id idempotency,
  irreversible quote-line consumption after release, cross-run daily-budget serialization, stale
  lock recovery, task-error propagation, and malformed reservation-ledger rejection.
- Settlement tests verify reservation-linked cost idempotency, recovery from `SETTLEMENT_PENDING`,
  over-cap uncertainty, and explicit reconciliation to settled or released.
- Lock regression coverage proves stale dead locks can be reclaimed while a live owner remains
  exclusive after the stale threshold.
- The clean-copy usage smoke exercises `producer approve cost` and confirms a zero-cost quote fails
  closed as an unnecessary approval before normal readiness continues.
- The diff-scoped Codex Security review completed with 12/12 worklist receipts and no reportable
  findings; the generated report is under the system temp
  `codex-security-scans/uykuluk-scifi/7bd5801bfede_20260619T045040Z/report.md`.
- The reservation diff security review completed with 14/14 worklist receipts. It reproduced and
  fixed one live-owner stale-lock race; no reportable finding survived the final policy and
  remediation gates. Report:
  `/tmp/codex-security-scans/uykuluk-scifi/30986f87b682_20260619T052633Z/report.md`.
- The run-ID validation diff security review completed with 9/9 worklist receipts and no reportable
  findings. One regex-anchor candidate was falsified with focused Vitest and direct Node runtime
  evidence. Report:
  `/tmp/codex-security-scans/uykuluk-scifi/e155b027681d_20260619T114436Z/report.md`.
- The artifact-path validation diff security review completed with 6/6 worklist receipts. It
  reproduced and fixed Windows reserved-device and trailing-dot alias acceptance; no reportable
  finding survived final policy and remediation. Report:
  `/tmp/codex-security-scans/uykuluk-scifi/f16e6434e22f_20260619T115254Z/report.md`.
- `pnpm security:dependencies` reports no known high-severity dependency vulnerabilities.
- Capability-routing docs pass formatting, changelog-marker, modularity, version-plan, full
  `pnpm check`, and clean-copy usage gates.
- Readiness passes with committed brand assets.
- Unit coverage confirms readiness rejects malformed, stale, tampered, hard-budget-blocked, or
  unapproved nonzero cost quote bundles.
- Production-package integrity coverage confirms generation records all derived artifact digests and
  that modification, deletion, foreign manifests, or approved-script drift block cost estimation and
  readiness while evidence reports the failure.
- The production-package integrity diff security review completed with 7/7 worklist receipts. It
  reproduced and fixed missing-manifest evidence reporting; no reportable finding survived. Report:
  `/tmp/codex-security-scans/uykuluk-scifi/d4a7e61a4ecf_20260619T120922Z/report.md`.
- Zod 4 migration coverage rejects deprecated chained string formats, object strict/passthrough
  methods, native enums, object merges, and legacy integer/number APIs across `src/`.
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
- Paid execution remains disabled until the first provider adapter makes the implemented reservation
  lifecycle its only pre-call path and receives end-to-end failure/timeout coverage.
