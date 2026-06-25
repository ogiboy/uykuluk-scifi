# Architecture Notes

## Current Shape

The project is a TypeScript, local-first, CLI-first producer workflow.

Primary contracts:

- `src/core/` owns run state, allowed transitions, artifact writes, ledgers, and safe errors.
- `src/stages/` owns workflow stages: ideas, approvals, script generation, review, production
  package, estimate, evidence, readiness, and disabled placeholders.
- `src/safeguards/` owns approval, budget, content, asset, and publish guards.
- `src/providers/` owns LLM adapters for mock and Ollama.
- `src/diagnostics/` owns project-level, read-only operator diagnostics; it must not mutate run
  state or imply workflow approval.
- `src/prompts/` owns runtime prompt provenance metadata shared by stages and evidence.
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

## Future Real Production Loop Ownership

The next product phase should extend the existing CLI/core flow toward a local video draft package:

- render planning belongs in the workflow stages and consumes the approved production package,
  scene/subtitle metadata, and tracked asset inventory;
- storyboard/contact-sheet output is an operator review artifact, not an approval by itself;
- asset provenance identifies the exact committed assets selected for a future render;
- local TTS is owned by the workflow stages and runs only after readiness, script approval,
  production-package integrity, and render-plan evidence. Deterministic reference audio is for
  pipeline timing; Piper remains an optional local binary/model-path adapter with ignored models;
- FFmpeg render is owned by the workflow stages and runs only after render planning, exact render
  approval, voiceover evidence, production-package integrity, and local artifact checks. Draft
  render manifests must record the exact scene-timed background timeline, overlay composition, and
  operator review checklist used for the local review MP4;
- analytics import/reporting consumes operator-provided CSV/JSON files, writes ignored local
  analytics artifacts, and links records back to runs when `runId` is present.

Render planning must not create a second workflow engine. It should reuse run state, artifact,
ledger, approval, evidence, readiness, asset, and cost patterns already owned by the CLI/core.

## Next.js Studio

The frontend lives under `apps/studio` as a local Next.js App Router app.

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

## Anti-Goals

- No cloud-first dashboard requirement.
- No database in the MVP unless file-backed persistence becomes insufficient.
- No autonomous publish path.
- No paid generation path before approval and cost gates are proven.
- No mutating frontend implementation before shared service contracts and route security rules are
  defined.
