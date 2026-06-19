# Working Rules

## General

- Read before editing.
- Keep changes focused and evidence-driven.
- Prefer extending the existing CLI/core contracts over creating parallel workflow logic.
- Treat modularity as ownership: state, approvals, costs, providers, stages, safeguards, assets, QA
  scripts, and future web surfaces should each have a clear owner.
- Do not let generated advisory state become product state. Durable guidance belongs in `.ai/`,
  `README.md`, `ROADMAP.md`, or source-controlled tests.
- Route skills, plugins, MCPs, connectors, browsers, and subagents through
  `.ai/capabilities.instructions.md`; do not reload the complete host catalog per thread.
- For long goals, keep a repository checkpoint and preserve the full completion criteria across
  context resets.

## Runtime Rules

- The workflow is approval-gated. LLMs create drafts; the operator approves progression.
- No expensive or irreversible step may run without a cost estimate and explicit approval.
- File existence never implies approval.
- Passing review never implies script approval.
- Passing readiness never implies render, upload, or publish approval.
- Public or scheduled YouTube publish must stay disabled by default.
- Guard failures must write reviewable ledger evidence.

## Storage Rules

- Runs are file-backed and inspectable under `runs/<run_id>/`.
- State, artifacts, approvals, warnings, costs, diagnostics, and evidence must remain resumable from
  disk.
- Update state only after required artifacts are written successfully.
- Prefer additive JSON/JSONL changes over destructive rewrites.

## Frontend Rules

- Future Next.js surfaces are operator shells over the core contracts, not a second workflow engine.
- Browser routes must not infer state from UI-only data.
- Route handlers must reject malformed input and disallowed actions.
- No web button may trigger TTS, render, upload, or publish before the same CLI gate exists and is
  tested.
- UI copy should eventually flow through a small translation accessor.
- Design should prioritize dense review, comparison, and repeated operation over marketing
  composition.

## Implementation Rules

- Prefer schema-first and typed data flow.
- Preserve clear failure modes.
- Add or update tests when behavior changes materially.
- Run focused checks for small changes and `pnpm qa:usage` for operator-flow changes.
- Update `.ai/current-state.instructions.md`, `.ai/tasks.instructions.md`, and
  `.ai/decisions.instructions.md` when a durable assumption changes.
