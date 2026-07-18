# Architecture Notes

## Current Shape

The project is a TypeScript, local-first, CLI-first producer workflow.

Primary contracts:

- `src/core/` owns run state, allowed transitions, artifact writes, ledgers, and safe errors.
- `src/stages/` owns workflow stage entrypoints for ideas, approvals, script generation, review,
  production package, estimate, evidence, readiness, and disabled placeholders. Domain helper
  folders stay internal to those stable entrypoints.
- `src/safeguards/` owns approval, budget, content, asset, and publish guards.
- `src/providers/` owns LLM adapters for mock, Ollama, and local OpenAI-compatible `llama.cpp`.
- `src/diagnostics/` owns project-level, read-only operator diagnostics; it must not mutate run
  state or imply workflow approval.
- `src/prompts/` owns runtime prompt provenance metadata shared by stages and evidence.
- `src/config/` owns current config defaults, schema parsing, project config loading, and
  initialization. The approved next settings slice will extend this owner with shared path
  resolution, strict versioned documents, command-boundary snapshots, atomic revisions, and redacted
  evidence; Studio will not write config JSON directly.
- `src/revisions/` owns attributable artifact edits, snapshots, stale-evidence invalidation, and
  revision ledger events.
- `src/costs/` owns cost event persistence, local budget calculations, reservation/settlement, and
  the internal adapter-bound execution contract for future nonzero provider calls.
- `src/analytics/` owns local operator-provided performance imports and non-causal reporting.
- `src/youtube/` currently owns disabled upload/publish scaffolds only.
- `apps/studio/` owns the local Next.js operator shell. It should call typed service contracts and
  must not duplicate workflow state.
- `assets/` owns visual production assets and manifest documentation.
- `scripts/` owns clean-copy operator usage QA, modularity gates, release checks, security scans,
  and SonarQube helpers.
- `.ai/` owns durable project policy, workflows, role guidance, and QA evidence.

## Source Of Truth

The CLI/core state machine is the source of truth. Future web surfaces must read and mutate the same
typed contracts rather than copying stage logic into frontend route handlers.

## Real Production Loop Ownership

The implemented CLI/core flow owns the local video draft package:

- render planning belongs in the workflow stages and consumes the approved production package,
  scene/subtitle metadata, and tracked asset inventory;
- storyboard/contact-sheet output is an operator review artifact, not an approval by itself;
- asset provenance identifies the exact committed assets selected for a future render;
- local TTS is owned by the workflow stages and runs only after readiness, script approval,
  production-package integrity, and render-plan evidence. Deterministic reference audio is for
  pipeline timing, `production/audio/voiceover_review.md` carries operator review guidance, and
  Piper remains an optional local binary/model-path adapter with ignored models;
- FFmpeg render is owned by the workflow stages and runs only after render planning, exact render
  approval, voiceover evidence, production-package integrity, and local artifact checks. Draft
  render manifests record separate intro, voiceover-backed scene, outro, total, and subtitle-clock
  timing plus the exact overlay composition used for the local review MP4, while
  `production/render/draft_review.md` carries the operator final review checklist;
- Stage internals live in domain folders such as `render/`, `script/`, `voice/`, `evidence/`, and
  `status/`; public workflow entrypoints such as `render.ts`, `script.ts`, `voice.ts`, and
  `reviewScript.ts` remain at the stage boundary;
- render retry/recovery belongs in `src/revisions/`: a non-accepted or explicitly attributed
  invalid-evidence draft is archived with its downstream evidence, its render approval is removed,
  and the canonical state machine returns to `READY_FOR_MANUAL_PRODUCTION` before any new approval;
- analytics import/reporting consumes operator-provided CSV/JSON files, writes ignored local
  analytics artifacts, and links records back to runs when `runId` is present.
- local LLM runtime selection belongs in `src/providers/` and diagnostics. Model quality remains an
  evaluation concern; render/TTS/publish stages must not depend on `.ai/` notes or a frontend-only
  model decision.

Render planning must not create a second workflow engine. It should reuse run state, artifact,
ledger, approval, evidence, readiness, asset, and cost patterns already owned by the CLI/core.

## Next.js Studio

The frontend lives under `apps/studio` as a local Next.js App Router app.

`apps/studio/src/lib` keeps page-facing data services and security entrypoints at its root. Run,
action, mutation, artifact, asset, routing, catalog, and observability helpers live in matching
domain folders and must not become a second workflow layer.

It should provide:

- run list and run detail views;
- artifact previews;
- approval forms;
- readiness and cost panels;
- evidence bundle browser;
- visual asset inventory;
- disabled future-action explanations.

It must not provide:

- hidden provider calls;
- arbitrary command execution;
- upload or publish bypasses;
- direct mutation of JSON artifacts without core validation;
- UI-only approvals.

Every existing or future Studio action route must be represented in the typed route-security
contract and the shared Studio mutation service contract catalog with request validation, CLI/core
binding metadata, CSRF protection, durable evidence writes, and an explicit approval target. Current
Studio uses read-only page surfaces plus guarded local mutation routes backed by shared CLI/core
contracts. Studio must not own workflow state, duplicate the state machine, or bypass CLI/core
guards; service contracts do not by themselves enable web mutations.

The approved, not-yet-implemented settings/prompt contract follows the same boundary: a save will
refresh the Studio projection and apply to the next command, while the current command keeps one
immutable, redacted config/prompt snapshot. Listener ports and build-time environment settings are
restart-required, and secret values remain outside config and Studio responses.

## Anti-Goals

- No cloud-first dashboard requirement.
- No database in v1 unless file-backed persistence becomes demonstrably insufficient.
- No autonomous publish path.
- No paid generation path before approval and cost gates are proven.
- No mutating frontend implementation before shared service contracts and route security rules are
  defined.
