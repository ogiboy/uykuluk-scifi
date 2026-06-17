# Setup Validation Playbook

Use after tooling or onboarding changes.

Commands:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm qa:usage
```

Expected:

- install succeeds;
- scripts do not require global-only tools beyond Node/Corepack/pnpm;
- clean-copy usage smoke passes;
- generated run artifacts stay ignored.
