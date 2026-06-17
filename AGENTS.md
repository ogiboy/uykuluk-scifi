# Agent Instructions

This file is the repository-local operating contract for AI agents working on UykulukSciFi Producer.

## Product Truths

- The project is a local-first production desk for UykulukSciFi YouTube videos.
- CLI/core owns run state, transitions, approvals, costs, readiness, and evidence.
- The Next.js Studio is an operator surface over typed local services, not a second workflow engine.
- Upload and public/scheduled publish are disabled by default.
- Prompt edits, artifact edits, and approvals must leave durable evidence.
- Assets under `assets/` are production inputs and must stay documented.

## Development Rules

- Prefer module-scoped branches after the initial repository bootstrap.
- Keep files small and owned by clear modules.
- Add abstractions only when they reduce real duplication or match the existing architecture.
- Use structured parsers and typed interfaces instead of ad hoc text mutation when practical.
- Do not commit `.env`, tokens, local Sonar credentials, generated run directories, or QA artifacts.
- Do not enable paid APIs, upload, render, or publish paths without explicit roadmap and approval
  work.

## Quality Gates

Run before push-ready handoff:

```bash
pnpm check
pnpm qa:usage
pnpm version:plan
```

Run additionally when relevant:

```bash
pnpm sonar:status
pnpm sonar
```

## Documentation

Update `README.md`, `ROADMAP.md`, `.ai/current-state.instructions.md`, `.ai/tasks.instructions.md`,
and `assets/README.md` whenever workflow contracts, assets, tooling, or product assumptions change.
