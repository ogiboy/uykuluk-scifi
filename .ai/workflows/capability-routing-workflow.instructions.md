# Capability Routing Workflow

Use before broad research, planning, implementation, design, marketing, analytics, security, QA, or
multi-agent work.

## Sequence

1. Read `.ai/capabilities.instructions.md`.
2. Classify the task using the routing matrix.
3. Verify the selected capability is installed/available.
4. Load only the selected skill bodies and deferred tools.
5. Choose single-agent or swarm execution.
6. State selected capabilities and why in one concise update.
7. Execute, verify, and persist evidence.
8. Update the capability inventory only when a refresh trigger fires.

## Selection Rules

- Prefer project-specific workflow contracts over generic skills.
- Prefer one primary workflow and normally one specialist per agent.
- Prefer native repository commands over external services.
- Prefer read-only research before external mutations.
- Do not use a capability merely because it is installed.
- Do not combine competing orchestration or browser-control stacks without a concrete reason.

## Completion

Report the selected route, evidence produced, and any capability gap discovered. Do not paste the
host-global capability catalog into the handoff.
