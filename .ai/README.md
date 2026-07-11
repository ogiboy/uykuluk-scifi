# UykulukSciFi Producer AI Instructions

This project is approval-gated. LLMs produce drafts; the operator approves progression.

Rules:

- No expensive step should run without a cost estimate.
- No public publish should happen without explicit approval.
- All runs must create evidence.
- All agent or LLM outputs must be persisted under `runs/<run_id>/`.
- Future Codex tasks should update tests and run readiness.
- Guard failures must be saved as reviewable ledger evidence.
- File existence never implies approval.

Durable project guidance:

- `rules.instructions.md` - project-wide working rules.
- `concept.instructions.md` - product concept and channel promise.
- `architecture.instructions.md` - current ownership and future dashboard shape.
- `decisions.instructions.md` - durable product and tooling decisions.
- `current-state.instructions.md` - current implemented state and validation.
- `tasks.instructions.md` - backlog and explicit non-goals.
- `design-system.instructions.md` - visual and UI direction.
- `development-preferences.instructions.md` - codebase, commit, push, and check preferences.
- `versioning.instructions.md` - version intent and release note buckets.
- `memory.instructions.md` - durable memory and future creative-memory rules.
- `capabilities.instructions.md` - mandatory low-context capability selection entry point.
- `capabilities/` - installed capability inventory, task routing, and orchestration rules.
- `checkpoints/` - durable continuation state for long-running goals.
- `templates/` - bounded agent brief and handoff contracts.
- `workflows/` - feature, frontend, QA, security, and tooling workflows.
- `agents/` - development-only review lenses.
- `security/` - threat models and development-time security review evidence.
