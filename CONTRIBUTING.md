# Contributing

UykulukSciFi Producer is a local-first production desk for a YouTube channel. Contributions should
preserve operator control, auditability, modularity, and explicit approvals.

## Project Boundaries

Preserve these invariants:

- CLI/core remains the source of truth for workflow state.
- Studio routes and components stay thin; they must not create a second state machine.
- Idea, script, render, upload, and publish approvals are explicit ledger events.
- Upload and public/scheduled publish remain disabled by default.
- Prompt edits must be versioned and visible in run evidence.
- Secrets stay in ignored local config or environment variables.
- Large binary artifacts are committed only when they are production inputs under `assets/`.

## Setup

```bash
pnpm install
pnpm producer init
pnpm check
```

Use the Studio shell during frontend work:

```bash
pnpm studio
```

## Contribution Flow

1. Read `README.md`, `ROADMAP.md`, and the relevant `.ai/` guidance.
2. Work on a module-scoped branch after the initial repository push.
3. Identify the owner: CLI/core, provider, safeguard, assets, Studio, QA, docs, or tooling.
4. Keep changes focused; avoid large mixed refactors.
5. Add or update tests and QA evidence for behavior changes.
6. Update README, ROADMAP, `.ai`, and asset docs when workflows or assumptions change.
7. Run the required checks before opening a PR.

## Required Checks

For most changes:

```bash
pnpm check
pnpm qa:usage
```

For security-sensitive or broad changes:

```bash
pnpm security:check
pnpm qa:modularity
pnpm sonar:status
```

For Studio work:

```bash
pnpm studio:typecheck
pnpm studio:build
```

## Commit Style

Use Conventional Commits:

- `feat(studio): add run detail shell`
- `fix(core): preserve approval ledger evidence`
- `docs(readme): clarify asset inventory`
- `ci(codeql): scope custom analysis paths`

Release and changelog tooling assume conventional subjects.

## Pull Requests

A good PR includes:

- what changed;
- why the approval and publish gates remain safe;
- tests and QA evidence;
- screenshots or browser evidence for Studio changes;
- known limitations or follow-up work.

Do not open product work directly on `main` after the initial repository bootstrap. Use a branch
named for the module or surface, such as `feat/studio-run-detail` or `ci/codeql-hardening`.
