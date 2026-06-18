# UykulukSciFi Producer Roadmap

This roadmap keeps the project local-first and approval-gated while moving from CLI-only production
control toward a local web studio.

## Product Direction

UykulukSciFi Producer should become a controlled production desk for the channel, not an autonomous
publishing machine. The CLI remains the first source of truth for workflow contracts, state
transitions, approvals, costs, evidence, and disabled upload/publish controls. A future web
interface should make those contracts easier to operate, not replace or weaken them.

## Phase 1 - CLI MVP

Status: implemented and under QA.

- Generate ideas in mock or local Ollama mode.
- Approve one idea explicitly.
- Generate and review a Turkish narration script.
- Approve the reviewed script explicitly.
- Bind script review, approval, and packaging to the same content digest.
- Generate voiceover text, subtitles, scene prompts, popup cards, and YouTube metadata drafts.
- Estimate costs.
- Generate evidence bundle and readiness diagnostics.
- Block readiness when the persisted cost estimate reports blocked reasons or disallows the next
  step.
- Validate run state on read/write and atomically replace persisted JSON files.
- Render tracked operator prompts at runtime and record prompt key/source/hash provenance for
  generated ideas, scripts, and production packages.
- Run budget preflight before provider-backed generation so an already-exceeded ledger cannot cause
  another provider call or generated artifact; use the stage pricing estimate for the reservation
  decision.
- Keep readiness diagnostics and evidence synchronized with the final run state.
- Keep voice, render, upload, and publish disabled by default.
- Persist state, artifacts, approvals, warnings, costs, and QA evidence.
- Warn on clickbait title framing and inventory brand, overlay, intro, and outro assets.
- Diagnose project config, mock/Ollama availability, required assets, and publish-default safety
  before a run through `producer doctor`.

Exit criteria:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm qa:usage`
- Readiness passes with committed brand assets.
- Upload and public/scheduled publish remain blocked by default.

Hardening still required:

- Define a dedicated paid-generation cost approval contract before any nonzero-cost provider is
  enabled; until then, approval-threshold estimates remain blocked.

## Phase 1.5 - Project Policy And Tooling

Status: in progress.

- Strengthen `.ai/` as the durable project operating contract.
- Keep CodeRabbit focused on approval gates, cost controls, evidence, assets, frontend route safety,
  and no public publish by default.
- Add Prettier as the shared formatting contract.
- Keep direct provider/publish safeguard tests and high-severity dependency audit in CI.
- Keep QA evidence under `.ai/qa/artifacts/`.
- Document visual asset inventory and gaps.

Exit criteria:

- `.ai/rules.instructions.md`, `.ai/architecture.instructions.md`, `.ai/decisions.instructions.md`,
  `.ai/current-state.instructions.md`, and `.ai/tasks.instructions.md` exist and match the current
  repo.
- `.ai/workflows/` covers feature, QA, security, and frontend work.
- `.ai/agents/` defines development-only role guidance.
- `.coderabbit.yaml`, `.prettierrc`, `.prettierignore`, and package scripts are present.

## Phase 2 - Local Next.js Producer Studio

Status: foundation in progress. The shell and i18n foundation exist; read-only run routes remain
planned until the CLI/core contracts are stable.

Use Next.js App Router for a local operator dashboard. The dashboard should be a thin web studio
over the existing local file/state contracts and should not become a second workflow engine.

Planned surfaces:

- Runs index with state, warnings, approvals, cost estimate, and next command.
- Run detail page with tabs for ideas, script, review, production package, costs, readiness,
  evidence, and ledger.
- Editable idea board: compare generated ideas, add manual idea notes, reject or approve one idea
  with explicit ledger evidence.
- Script workspace: edit narration draft locally before review, keep revision history, and require
  review after edits.
- Prompt studio: edit planner, scriptwriter, review, production package, and readiness prompts from
  a guarded UI with preview/diff and rollback.
- Production package editor: adjust subtitle segments, scene prompts, popup cards, lower-third
  suggestions, and YouTube metadata before render work.
- Approval modals for idea and script only after the current artifact is visible.
- Readiness panel with pass/warn/block rows.
- Asset inventory page showing brand/overlay/intro/outro readiness.
- Disabled future-action panel for TTS/render/upload/publish, with clear missing approval/config
  explanations.

Frontend constraints:

- Local-first, no hosted dependency required to operate the MVP.
- Server actions or route handlers may call typed local service contracts, not arbitrary shell
  commands.
- No public upload or scheduled publish control until the CLI supports the same approval/config
  gates.
- App Router, TypeScript, Tailwind, shadcn-style primitives, Radix UI, lucide icons, GSAP, and
  `next/font` are acceptable when introduced deliberately.
- Operator copy should flow through a small translation accessor instead of scattered string
  constants. The `next-intl` request/provider foundation is in place; copy migration is deferred
  until operator surfaces are implemented.
- Design should feel like a quiet production desk: dense, readable, restrained, scan-friendly, and
  built for repeated review.
- Prompt editing is a first-class operator workflow, but prompt changes must be saved as versioned
  local artifacts and should never silently alter an active run.
- UI-editable production fields should write explicit revision events so the evidence bundle can
  explain what changed.

Exit criteria:

- Dashboard read-only routes pass first.
- Approval actions have CSRF/same-origin/token controls appropriate for local operation.
- Browser QA screenshots and route negative tests exist.
- Playwright browser smoke covers the Studio shell before each push-ready handoff.
- CLI and web views agree on run state and evidence.
- Prompt edits have diff/preview/revert behavior and cannot bypass approval gates.

## Phase 2.1 - Prompt And Revision Management

Status: planned.

The current `.ai/prompts/` files are operator-facing runtime defaults for ideas, scripts, and
production packages. A future dashboard should let the operator inspect and edit prompt templates
without turning prompt changes into hidden state.

Planned contracts:

- `prompts/` source templates remain tracked defaults.
- Local prompt overrides live under an ignored runtime path or a future source-controlled
  `prompt-packs/` contract after review.
- Every prompt edit records editor, timestamp, prompt key, old hash, new hash, and reason.
- Runs record which prompt hash produced each artifact.
- Prompt preview renders variables before execution.
- Prompt rollback is available before running generation.

Prompt editing must not:

- run generation automatically;
- approve a stage;
- mutate previous run artifacts;
- hide changed prompt hashes from evidence.

## Phase 2.2 - Modular Core/Web Service Boundary

Status: planned.

Before a web UI mutates state, extract shared service functions so CLI and web call the same
contracts.

Likely modules:

- `src/services/runService.ts`
- `src/services/promptService.ts`
- `src/services/assetService.ts`
- `src/services/approvalService.ts`
- `src/services/readinessService.ts`

Rules:

- services own validation and side effects;
- CLI and web stay thin;
- React components do not import raw filesystem helpers;
- route handlers validate shape, call services, and return stable JSON.

## Phase 3 - Real Local Providers

Status: foundation in progress.

- `producer doctor` provides local config, provider, asset, and publish-default diagnostics with
  durable ignored JSON/Markdown evidence.
- Improve Ollama model availability checks.
- Record provider duration and token estimates consistently.
- Keep provider failures explicit in readiness and evidence.
- Do not introduce paid APIs until cost approval semantics are tested.

## Phase 4 - TTS And Render

Status: planned.

- Add local Piper or equivalent TTS only after script approval and cost estimate.
- Add FFmpeg render with committed UykulukSciFi assets.
- Watermark, subtitle panel, lower-third, popup cards, and title/end cards should come from
  `assets/`.
- Render must require explicit approval.
- Render output should be local artifact only.

## Phase 5 - Private Upload

Status: planned, disabled by default.

- Implement private YouTube upload only after upload approval and explicit config.
- Never make upload public by default.
- Persist upload request, response, and evidence.
- Keep public/scheduled publish separate from private upload.

## Phase 6 - Public Or Scheduled Publish

Status: future risk review.

This is not part of the current MVP.

Before any public/scheduled publish path exists:

- Explicit publish approval must be separate from upload approval.
- Readiness must prove the exact video, metadata, cost, review, and approval trail.
- The user must see a final irreversible-action warning.
- QA must include negative tests for missing config, missing approval, stale approval, and
  non-public default behavior.

## Visual Asset Status

The current asset packs cover logo, watermark, banner, lower-third, name panel, popup info card,
subtitle panels, title card, end screen, thumbnail templates, text-safe thumbnail overlays,
background plates, glitch/no-signal transition overlays, popup icons, waveform overlays, and
intro/outro render source frames.

Useful additions before render work now focus on editability and licensing:

- Editable Figma, PSD, SVG, or layered source files for thumbnail and overlay text variants.
- Render-ready intro/outro MP4 clips generated from the committed source frames.
- Font files and license notes for recurring title, thumbnail, lower-third, and subtitle typography.
- Additional series-specific background plates once recurring episode categories are defined.
- Storyboard or contact-sheet template for reviewing generated scene prompts before render work.
