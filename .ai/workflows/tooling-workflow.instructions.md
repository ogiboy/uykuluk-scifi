# Tooling Workflow

Use when changing package scripts, lint, format, CodeRabbit, CI, or release metadata.

## Rules

- Tooling should reinforce product risk checks, not only style.
- Keep generated reports and dependency caches out of git.
- Keep large binary assets out of automated review where practical.
- Update README or `.ai/current-state.instructions.md` when command behavior changes.

## Expected Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm qa:usage
pnpm sonar:status
```

If local PATH lacks `node` or `pnpm`, fix PATH/Corepack or use the Codex bundled Node for
verification, then record the environment caveat.

## SonarQube

- Local Docker SonarQube target: `uykuluk-scifi`.
- SonarCloud target: `ogiboy_uykuluk-scifi`.
- Use `pnpm sonar:start`, `pnpm sonar:status`, `pnpm sonar`, and `pnpm sonar:cloud`.
- Scanner tokens come from `SONAR_TOKEN` or Keychain services, never tracked files.
