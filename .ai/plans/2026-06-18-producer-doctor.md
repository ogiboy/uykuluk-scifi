# Producer Doctor Implementation Plan

## Goal

Add a read-only `pnpm producer doctor` command that diagnoses local configuration, LLM provider
availability, production assets, and publish-default safety before an operator starts a run.

## Architecture

- `src/diagnostics/doctor.ts` owns project-level diagnostic orchestration and report persistence.
- `src/providers/ollamaProvider.ts` owns Ollama reachability and model-availability inspection.
- `src/safeguards/assetGuard.ts` remains the asset inventory authority.
- `src/cli.ts` only renders the typed report and maps blocked diagnostics to a nonzero exit.
- Reports are local generated evidence under ignored `diagnostics/doctor.json` and
  `diagnostics/doctor.md`; doctor never creates or mutates a run.

## Tech Stack

TypeScript, Commander, Zod-backed config loading, Vitest, JSON and Markdown local evidence.

## Baseline / Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/tasks.instructions.md`
- `.ai/runbooks/local-dev.md`
- `ROADMAP.md` Phase 3

## Compatibility Boundary

- Mock mode remains the default and passes without network access.
- Ollama diagnosis uses `/api/tags`; it does not generate content.
- Missing/invalid config or unavailable/missing Ollama model blocks doctor with clear evidence.
- Missing assets warn but do not block local core development.
- Upload/public publish remain disabled; risky enablement blocks doctor.
- Existing workflow commands, run state, approvals, and run artifacts remain unchanged.

## Verification

```bash
pnpm exec vitest run tests/doctor.test.ts
pnpm check
pnpm qa:usage
pnpm build
pnpm version:plan
pnpm security:dependencies
```

## Tasks

1. Write failing Vitest coverage for mock success, Ollama unavailability/model absence, durable
   reports, and no run mutation.
2. Implement typed Ollama diagnostics and project doctor orchestration.
3. Add the CLI command and clean-copy usage smoke coverage.
4. Update README, ROADMAP, `.ai` current state/tasks/runbooks/checklists, assets documentation, and
   changelog.
5. Run focused and full gates; inspect the diff; commit only when green.

## Risks and Retirement

- Network checks must have a bounded timeout and must not invoke generation.
- Project diagnostics are advisory and must not become workflow approval.
- No old implementation is retained; the backlog-only doctor placeholder is retired when command,
  evidence, tests, and docs are green.
